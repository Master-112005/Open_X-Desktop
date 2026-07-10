const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const { ensureDataRoot } = require('../assistant/Data');
const COMMUNICATION_EVENTS = require('./CommunicationEvents');
const WhatsAppSelectors = require('./WhatsAppSelectors');
const {
  BrowserNotRunningError,
  BrowserStartingError,
  DomSelectorChangedError,
  ProviderUnavailableError,
  QRLoginRequiredError,
  WhatsAppLoadingError
} = require('./CommunicationErrors');

const DEFAULT_LAUNCH_TIMEOUT_MS = 30000;
const DEFAULT_NAVIGATION_TIMEOUT_MS = 20000;
const DEFAULT_READY_TIMEOUT_MS = 30000;
const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const DETECTION_CANDIDATE_TIMEOUT_MS = 250;
const INSPECTION_TIMEOUT_MS = 1000;

function timestampForFilename(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

const SESSION_STATES = Object.freeze({
  INITIALIZING: 'INITIALIZING',
  LOADING: 'LOADING',
  QR_REQUIRED: 'QR_REQUIRED',
  CONNECTED: 'CONNECTED',
  OFFLINE: 'OFFLINE',
  UNKNOWN: 'UNKNOWN',
  DISCONNECTED: 'DISCONNECTED',
  RECONNECTING: 'RECONNECTING',
  UNSUPPORTED_LAYOUT: 'UNSUPPORTED_LAYOUT',
  ERROR: 'ERROR'
});

function loadPlaywright() {
  try {
    return require('playwright');
  } catch (_) {
    return null;
  }
}

class WhatsAppSessionManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = options.config || {};
    this.logger = options.logger || console;
    this.debug = options.debug === true || this.config?.communication?.debug === true;
    this.playwright = options.playwright || null;
    this.context = options.context || null;
    this.page = options.page || null;
    this.connecting = null;
    this.setTimer = options.setTimeout || setTimeout;
    this.clearTimer = options.clearTimeout || clearTimeout;
    this.idleTimeoutMs = Math.max(
      1000,
      Number(options.idleTimeoutMs) || Number(this.config?.communication?.whatsapp?.idleTimeoutMs) || DEFAULT_IDLE_TIMEOUT_MS
    );
    this.idleTimer = null;
    this.idleClosing = null;
    this._contextCloseHandler = null;
    this._pageCrashHandler = null;
    this._pageConsoleHandler = null;
    this.lastState = this.page ? SESSION_STATES.INITIALIZING : SESSION_STATES.DISCONNECTED;
    this.lastLayout = null;
    this.consoleLogs = [];
    this.preserveStateOnClose = false;
    this.profileDir = options.profileDir || this._resolveProfileDir();
    this.diagnosticsDir = options.diagnosticsDir || this._resolveDiagnosticsDir();
  }

  _resolveProfileDir() {
    const paths = ensureDataRoot(this.config);
    return path.join(paths.root, 'communication', 'whatsapp', 'profile');
  }

  _resolveDiagnosticsDir() {
    return path.join(ensureDataRoot(this.config).root, 'communication', 'diagnostics');
  }

  async connect(options = {}) {
    if (this.context && this.page) {
      if (options.visible === true) {
        await this._showPageWindow(this.page);
      }
      if (options.waitForLogin === true) {
        const state = await this.waitForConnected(options.loginTimeoutMs);
        if (options.closeAfterLogin === true && state === SESSION_STATES.CONNECTED) {
          await this._closeContext({ preserveState: true });
        }
      }
      this.touch();
      return this.page;
    }
    if (this.connecting) {
      return this.connecting;
    }

    let connected = false;
    this.connecting = this._launch(options)
      .then(async page => {
        if (options.waitForLogin === true) {
          const state = await this.waitForConnected(options.loginTimeoutMs);
          if (options.closeAfterLogin === true && state === SESSION_STATES.CONNECTED) {
            await this._closeContext({ preserveState: true });
          }
        }
        connected = true;
        return page;
      })
      .finally(() => {
        this.connecting = null;
        if (connected) this.touch();
      });
    return this.connecting;
  }

  async _launch(options = {}) {
    fs.mkdirSync(this.profileDir, { recursive: true });
    this._setState(this.context ? SESSION_STATES.RECONNECTING : SESSION_STATES.INITIALIZING);
    const playwright = this.playwright || loadPlaywright();
    const chromium = playwright?.chromium;
    if (!chromium?.launchPersistentContext) {
      throw new ProviderUnavailableError(
        'whatsapp',
        'Playwright is not installed. Install the playwright package to use WhatsApp communication.'
      );
    }

    const visible = options.visible === true;
    const background = options.background === true && !visible;
    const headless = this.config?.communication?.whatsapp?.headless === true;
    const args = [
      '--disable-notifications',
      '--no-default-browser-check',
      '--disable-features=Translate,InterestFeedContentSuggestions,MediaRouter',
      '--disable-background-networking'
    ];

    this.context = await this._runStage('launch-browser', () => chromium.launchPersistentContext(this.profileDir, {
      headless,
      viewport: { width: 1280, height: 900 },
      locale: 'en-US',
      args,
      acceptDownloads: false
    }), this._stageTimeout(options, 'launchTimeoutMs', DEFAULT_LAUNCH_TIMEOUT_MS));
    this._debug('browser-launched', {
      profileDir: this.profileDir,
      browserRunning: true,
      visible,
      background,
      headless
    });
    this.context.setDefaultTimeout(this.config?.communication?.operationTimeoutMs || 8000);
    this.context.setDefaultNavigationTimeout(DEFAULT_NAVIGATION_TIMEOUT_MS);
    const launchedContext = this.context;
    this._contextCloseHandler = () => this._handleContextClosed(launchedContext);
    this.context.on?.('close', this._contextCloseHandler);

    this.page = this.context.pages?.()[0] || await this._runStage(
      'create-page',
      () => this.context.newPage(),
      this._stageTimeout(options, 'pageTimeoutMs', 5000)
    );
    this._pageCrashHandler = () => {
      this._setState(SESSION_STATES.ERROR);
      this.emit(COMMUNICATION_EVENTS.ERROR, {
        provider: 'whatsapp',
        code: 'PAGE_CRASHED'
      });
    };
    this._pageConsoleHandler = message => this._recordConsole(message);
    this.page.on?.('crash', this._pageCrashHandler);
    this.page.on?.('console', this._pageConsoleHandler);
    await this._runStage(
      'load-whatsapp',
      () => this.page.goto(WhatsAppSelectors.url, { waitUntil: 'domcontentloaded' }),
      this._stageTimeout(options, 'navigationTimeoutMs', DEFAULT_NAVIGATION_TIMEOUT_MS)
    );
    if (this.config?.communication?.whatsapp?.inspector === true && this.page.pause) {
      this.logger.warn?.('[WhatsAppSession] Playwright inspector paused');
      await this.page.pause();
    }
    const initialSnapshot = await this._runStage(
      'detect-initial-state',
      () => this.detectState({ includeSnapshot: true }),
      this._stageTimeout(options, 'stateTimeoutMs', 5000)
    );
    if (initialSnapshot.state === SESSION_STATES.UNKNOWN) {
      void this.captureDiagnostics('unknown-initial-page', initialSnapshot).catch(() => {});
    }
    if (visible) {
      await this._runStage('show-browser-window', () => this._showPageWindow(this.page), 5000);
    }
    return this.page;
  }

  async disconnect() {
    await this._closeContext();
  }

  async _closeContext(options = {}) {
    this._clearIdleTimer();
    const context = this.context;
    const page = this.page;
    const state = this.lastState;
    this._detachResourceListeners(context, page);
    this.context = null;
    this.page = null;
    this._setState(options.preserveState ? state : SESSION_STATES.DISCONNECTED);
    if (context) {
      await context.close();
      this.emit(COMMUNICATION_EVENTS.DISCONNECTED, { provider: 'whatsapp' });
    }
  }

  _handleContextClosed(context) {
    if (context && this.context && context !== this.context) return;
    this._clearIdleTimer();
    this._detachResourceListeners(context, this.page);
    this.context = null;
    this.page = null;
    if (!this.preserveStateOnClose) {
      this._setState(SESSION_STATES.DISCONNECTED);
    }
    this.preserveStateOnClose = false;
    this.emit(COMMUNICATION_EVENTS.DISCONNECTED, { provider: 'whatsapp' });
  }

  _detachResourceListeners(context = this.context, page = this.page) {
    const remove = (target, event, listener) => {
      if (!target || !listener) return;
      if (typeof target.off === 'function') target.off(event, listener);
      else target.removeListener?.(event, listener);
    };
    remove(context, 'close', this._contextCloseHandler);
    remove(page, 'crash', this._pageCrashHandler);
    remove(page, 'console', this._pageConsoleHandler);
    this._contextCloseHandler = null;
    this._pageCrashHandler = null;
    this._pageConsoleHandler = null;
  }

  touch() {
    if (!this.context || !this.page || this.connecting) return false;
    this._clearIdleTimer();
    this.idleTimer = this.setTimer(() => {
      this.idleTimer = null;
      this.idleClosing = this._closeContext()
        .catch(error => this.logger.warn?.('[WhatsAppSession] idle shutdown failed', { error: error.message }))
        .finally(() => {
          this.idleClosing = null;
        });
    }, this.idleTimeoutMs);
    this.idleTimer.unref?.();
    return true;
  }

  _clearIdleTimer() {
    if (!this.idleTimer) return;
    this.clearTimer(this.idleTimer);
    this.idleTimer = null;
  }

  async getPage(options = {}) {
    if (!this.page) {
      await this.connect(options);
    }
    this.touch();
    return this.page;
  }

  isBrowserRunning() {
    return Boolean(this.context && this.page);
  }

  async ensureReady(options = {}) {
    const timeoutMs = Math.max(1000, Number(options.timeoutMs) || this.config?.communication?.readyTimeoutMs || DEFAULT_READY_TIMEOUT_MS);
    this._debug('ensure-ready-start', this._diagnostics());

    if (this.connecting) {
      this._setState(SESSION_STATES.INITIALIZING);
      await this._runStage('wait-for-existing-connection', () => this.connecting, timeoutMs).catch(error => {
        this._setState(SESSION_STATES.ERROR);
        throw new BrowserStartingError('whatsapp', this._diagnostics(error));
      });
    }

    if (!this.context || !this.page) {
      await this._runStage('start-connection', () => this.connect({
        visible: options.visible === true,
        background: options.background === true,
        timeoutMs
      }), timeoutMs).catch(error => {
        this._setState(SESSION_STATES.ERROR);
        throw new BrowserNotRunningError('whatsapp', this._diagnostics(error));
      });
    }

    const startedAt = Date.now();
    let lastSnapshot = null;
    while (Date.now() - startedAt <= timeoutMs) {
      const remainingMs = Math.max(1, timeoutMs - (Date.now() - startedAt));
      let snapshot;
      try {
        snapshot = await this._runStage('detect-state', () => this.detectState({ includeSnapshot: true }), Math.min(5000, remainingMs));
      } catch (error) {
        const diagnostics = await this._runStage(
          'capture-state-diagnostics',
          () => this.captureDiagnostics('detect-state-timeout'),
          Math.min(2000, remainingMs)
        ).catch(diagnosticError => ({ error: diagnosticError.message }));
        throw new DomSelectorChangedError('whatsapp', this._diagnostics(error, {
          state: SESSION_STATES.UNKNOWN,
          layout: 'Unknown',
          diagnostics
        }));
      }
      lastSnapshot = snapshot;
      if (snapshot.state === SESSION_STATES.CONNECTED) {
        this._debug('ensure-ready-connected', this._diagnostics(null, snapshot));
        this.touch();
        return this.page;
      }
      if (snapshot.state === SESSION_STATES.QR_REQUIRED) {
        throw new QRLoginRequiredError('whatsapp', this._diagnostics(null, snapshot));
      }
      if (snapshot.state === SESSION_STATES.UNKNOWN || snapshot.state === SESSION_STATES.UNSUPPORTED_LAYOUT) {
        const diagnostics = await this._runStage(
          'capture-state-diagnostics',
          () => this.captureDiagnostics('unknown-page-state', snapshot),
          Math.min(2000, remainingMs)
        ).catch(error => ({ error: error.message }));
        throw new DomSelectorChangedError('whatsapp', this._diagnostics(null, { ...snapshot, diagnostics }));
      }
      if (snapshot.state === SESSION_STATES.ERROR || snapshot.state === SESSION_STATES.DISCONNECTED) {
        throw new BrowserNotRunningError('whatsapp', this._diagnostics(null, snapshot));
      }
      await this._runStage('wait-for-ready-state', () => this.page.waitForTimeout?.(300), 1000);
    }

    if (lastSnapshot?.state === SESSION_STATES.LOADING && lastSnapshot?.dom?.loading?.visible) {
      throw new WhatsAppLoadingError('whatsapp', this._diagnostics(null, lastSnapshot));
    }
    const diagnostics = await this.captureDiagnostics('required-elements-missing', lastSnapshot);
    throw new DomSelectorChangedError('whatsapp', this._diagnostics(null, { ...lastSnapshot, diagnostics }));
  }

  async detectState(options = {}) {
    const page = this.page;
    if (!page) {
      this._setState(SESSION_STATES.DISCONNECTED);
      return options.includeSnapshot ? { state: this.lastState, dom: null } : this.lastState;
    }

    const inspection = await this._inspectPage();
    const dom = await this._detectDomState();
    const layout = this._detectLayout(dom);
    this.lastLayout = layout;
    if (layout === WhatsAppSelectors.layouts.QR_LOGIN) {
      this._setState(SESSION_STATES.QR_REQUIRED);
      this.emit(COMMUNICATION_EVENTS.QR_CODE_DETECTED, { provider: 'whatsapp' });
    } else if (layout === WhatsAppSelectors.layouts.LOADING) {
      this._setState(SESSION_STATES.LOADING);
    } else if (layout === 'Offline') {
      this._setState(SESSION_STATES.OFFLINE);
    } else if (
      layout === WhatsAppSelectors.layouts.LOGGED_IN ||
      layout === WhatsAppSelectors.layouts.CHAT_OPEN ||
      layout === WhatsAppSelectors.layouts.EMPTY_CHAT
    ) {
      this._setState(SESSION_STATES.CONNECTED);
      this.emit(COMMUNICATION_EVENTS.CONNECTED, { provider: 'whatsapp' });
    } else {
      this._setState(SESSION_STATES.UNKNOWN);
    }

    const snapshot = { state: this.lastState, layout, dom, url: inspection.url, inspection };
    this.logger.info?.('[WhatsAppSession] state inspected', {
      state: snapshot.state,
      layout,
      url: inspection.url,
      title: inspection.title,
      readyState: inspection.readyState,
      htmlLength: inspection.htmlLength,
      found: this._requiredElementReport(dom)?.found || []
    });
    this._debug('state-detected', this._diagnostics(null, snapshot));
    return options.includeSnapshot ? snapshot : this.lastState;
  }

  async isConnected() {
    return (await this.detectState()) === SESSION_STATES.CONNECTED;
  }

  async waitForConnected(timeoutMs = 5 * 60 * 1000) {
    const page = await this.getPage();
    const deadline = Date.now() + Math.max(1000, Number(timeoutMs) || 5 * 60 * 1000);
    while (Date.now() < deadline) {
      const snapshot = await this.detectState({ includeSnapshot: true });
      if (snapshot.state === SESSION_STATES.CONNECTED) {
        return snapshot.state;
      }
      await page.waitForTimeout?.(500);
    }
    return this.detectState();
  }

  async health() {
    const state = this.page ? await this.detectState() : this.lastState;
    return {
      provider: 'whatsapp',
      connected: state === SESSION_STATES.CONNECTED,
      state,
      profileReady: Boolean(this.profileDir && fs.existsSync(this.profileDir)),
      browserRunning: Boolean(this.context && this.page)
    };
  }

  async _anyVisible(selectors) {
    for (const selector of selectors) {
      try {
        const locator = this.page.locator(selector).first();
        if (await locator.count() > 0 && await locator.isVisible()) {
          return true;
        }
      } catch (_) {}
    }
    return false;
  }

  async _detectDomState() {
    const names = ['qrCode', 'loading', 'offline', 'sidebar', 'chatList', 'conversationList', 'mainPane', 'searchBox', 'messageInput', 'sendButton'];
    return Object.fromEntries(await Promise.all(names.map(async name => [name, await this._selectorSignal(name)])));
  }

  async _selectorSignal(name) {
    const result = await WhatsAppSelectors.resolveElement(this.page, name, {
      timeoutMs: DETECTION_CANDIDATE_TIMEOUT_MS
    });
    return {
      name,
      visible: result.found,
      selector: result.selector,
      strategy: result.strategy || null,
      attempts: result.attempts
    };
  }

  _detectLayout(dom) {
    if (dom.offline.visible) return 'Offline';
    if (dom.loading.visible) return WhatsAppSelectors.layouts.LOADING;
    if (dom.qrCode.visible) return WhatsAppSelectors.layouts.QR_LOGIN;
    if (dom.sidebar.visible && dom.messageInput.visible) return WhatsAppSelectors.layouts.CHAT_OPEN;
    if ((dom.sidebar.visible || dom.chatList.visible) && dom.mainPane.visible && !dom.messageInput.visible) {
      return WhatsAppSelectors.layouts.EMPTY_CHAT;
    }
    if (dom.sidebar.visible || dom.chatList.visible || dom.searchBox.visible) return WhatsAppSelectors.layouts.LOGGED_IN;
    return 'Unknown';
  }

  async captureDiagnostics(reason = 'whatsapp-diagnostics', snapshot = null, resolverReport = null) {
    const page = this.page;
    const safeReason = String(reason).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'whatsapp';
    const prefix = `${timestampForFilename()}-${safeReason}`;
    fs.mkdirSync(this.diagnosticsDir, { recursive: true });
    const paths = {
      report: path.join(this.diagnosticsDir, `${prefix}.json`),
      screenshot: path.join(this.diagnosticsDir, `${prefix}.png`),
      html: path.join(this.diagnosticsDir, `${prefix}.html`),
      accessibility: path.join(this.diagnosticsDir, `${prefix}.accessibility.json`),
      console: path.join(this.diagnosticsDir, `${prefix}.console.json`)
    };

    const report = {
      provider: 'whatsapp',
      reason,
      capturedAt: new Date().toISOString(),
      url: snapshot?.inspection?.url || await this._safeUrl(),
      state: snapshot?.state || this.lastState,
      layout: snapshot?.layout || this.lastLayout,
      inspection: snapshot?.inspection || await this._inspectPage(),
      elements: this._summarizeElements(snapshot?.dom || null),
      resolverReport,
      files: paths
    };

    if (page) {
      await page.screenshot?.({ path: paths.screenshot, fullPage: true }).catch(error => { report.screenshotError = error.message; });
      const html = await page.content?.().catch(error => {
        report.htmlError = error.message;
        return null;
      });
      if (html !== null && html !== undefined) fs.writeFileSync(paths.html, html, 'utf8');
      const accessibility = await this._accessibilitySnapshot(page);
      fs.writeFileSync(paths.accessibility, JSON.stringify(accessibility, null, 2), 'utf8');
    }

    fs.writeFileSync(paths.console, JSON.stringify(this.consoleLogs.slice(-100), null, 2), 'utf8');
    fs.writeFileSync(paths.report, JSON.stringify(report, null, 2), 'utf8');
    return report;
  }

  _summarizeElements(dom) {
    if (!dom) return null;
    return Object.fromEntries(Object.entries(dom).map(([key, value]) => [key, {
      found: Boolean(value.visible),
      strategy: value.strategy || null,
      selector: value.selector || null
    }]));
  }

  async _accessibilitySnapshot(page) {
    if (page.accessibility?.snapshot) {
      return page.accessibility.snapshot().catch(error => ({ error: error.message }));
    }
    try {
      const client = await this.context?.newCDPSession?.(page);
      if (!client) return { error: 'Accessibility snapshot unavailable' };
      const tree = await client.send('Accessibility.getFullAXTree');
      await client.detach?.();
      return tree;
    } catch (error) {
      return { error: error.message };
    }
  }

  _recordConsole(message) {
    const entry = {
      at: new Date().toISOString(),
      type: typeof message.type === 'function' ? message.type() : message.type,
      text: typeof message.text === 'function' ? message.text() : String(message)
    };
    this.consoleLogs.push(entry);
    this.consoleLogs = this.consoleLogs.slice(-200);
  }

  async _inspectPage() {
    const page = this.page;
    if (!page) return { url: '', title: '', readyState: 'unavailable', htmlLength: 0, visibleText: '' };
    const [url, title, details] = await Promise.all([
      this._readPage(() => page.url?.(), ''),
      this._readPage(() => page.title?.(), ''),
      this._readPage(() => page.evaluate?.(() => {
        const summary = (selector, fields) => Array.from(document.querySelectorAll(selector)).slice(0, 20).map(node => (
          Object.fromEntries(fields.map(field => [field, node.getAttribute(field) || '']))
        ));
        return {
          readyState: document.readyState,
          htmlLength: document.documentElement?.outerHTML.length || 0,
          visibleText: (document.body?.innerText || '').slice(0, 6000),
          forms: summary('form', ['action', 'method', 'name']),
          inputs: summary('input, textarea, [contenteditable="true"]', ['type', 'name', 'placeholder', 'aria-label']),
          buttons: summary('button, [role="button"]', ['aria-label', 'title', 'data-testid']),
          lists: summary('ul, ol, [role="list"], [role="grid"]', ['aria-label', 'data-testid']),
          landmarks: summary('main, nav, aside, header, footer, [role="main"], [role="navigation"]', ['role', 'aria-label'])
        };
      }), {})
    ]);
    return { url, title, ...details, consoleErrors: this.consoleLogs.filter(entry => entry.type === 'error').slice(-20) };
  }

  async _readPage(work, fallback) {
    let timer = null;
    try {
      return await Promise.race([
        Promise.resolve().then(work),
        new Promise(resolve => { timer = setTimeout(() => resolve(fallback), INSPECTION_TIMEOUT_MS); })
      ]);
    } catch (_) {
      return fallback;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  _setState(state) {
    if (this.lastState === state) return;
    this.lastState = state;
    this._debug('state-change', this._diagnostics());
  }

  async _safeUrl() {
    try {
      return this.page?.url?.() || '';
    } catch (_) {
      return '';
    }
  }

  _diagnostics(error = null, snapshot = null) {
    const dom = snapshot?.dom || null;
    return {
      state: snapshot?.state || this.lastState,
      layout: snapshot?.layout || this.lastLayout,
      profileDir: this.profileDir,
      pageUrl: snapshot?.url || this._pageUrl(),
      loginState: snapshot?.state || this.lastState,
      domState: dom
        ? Object.fromEntries(Object.entries(dom).map(([key, value]) => [key, {
            visible: value.visible,
            selector: value.selector,
            strategy: value.strategy || null
          }]))
        : null,
      requiredElements: this._requiredElementReport(dom),
      diagnostics: snapshot?.diagnostics || null,
      browser: {
        context: Boolean(this.context),
        page: Boolean(this.page),
        connecting: Boolean(this.connecting)
      },
      error: error ? { name: error.name, message: error.message, code: error.code || null } : null
    };
  }

  _debug(message, data = {}) {
    if (!this.debug) return;
    this.logger.info?.(`[WhatsAppSession] ${message}`, data);
  }

  _stageTimeout(options, name, fallback) {
    const configured = Number(options?.[name]) || Number(this.config?.communication?.whatsapp?.[name]);
    return Math.max(1000, Number.isFinite(configured) ? configured : fallback);
  }

  async _runStage(stage, work, timeoutMs) {
    const startedAt = Date.now();
    this.logger.info?.('[WhatsAppSession] stage started', { stage, timeoutMs });
    let timer = null;
    try {
      const value = await Promise.race([
        Promise.resolve().then(work),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            const error = new Error(`WhatsApp ${stage} timed out after ${timeoutMs}ms`);
            error.code = 'WHATSAPP_STAGE_TIMEOUT';
            error.stage = stage;
            reject(error);
          }, timeoutMs);
        })
      ]);
      this.logger.info?.('[WhatsAppSession] stage completed', { stage, durationMs: Date.now() - startedAt });
      return value;
    } catch (error) {
      this.logger.warn?.('[WhatsAppSession] stage failed', {
        stage,
        durationMs: Date.now() - startedAt,
        code: error.code || null,
        error: error.message
      });
      if (stage.includes('detect')) {
        void this.captureDiagnostics(`${stage}-timeout`).catch(diagnosticError => {
          this.logger.warn?.('[WhatsAppSession] timeout diagnostics failed', { error: diagnosticError.message });
        });
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  _pageUrl() {
    try {
      return this.page?.url?.() || '';
    } catch (_) {
      return '';
    }
  }

  _requiredElementReport(dom) {
    if (!dom) return null;
    const names = ['searchBox', 'conversationList', 'messageInput', 'sendButton', 'chatList', 'qrCode', 'sidebar'];
    const found = names.filter(name => dom[name]?.visible);
    return {
      found,
      missing: names.filter(name => !found.includes(name))
    };
  }

  hasPersistentSession() {
    return [
      path.join(this.profileDir, 'Local State'),
      path.join(this.profileDir, 'Default', 'Local Storage'),
      path.join(this.profileDir, 'Default', 'IndexedDB')
    ].some(target => fs.existsSync(target));
  }

  async _showPageWindow(page) {
    try {
      const client = await this.context.newCDPSession(page);
      const { windowId } = await client.send('Browser.getWindowForTarget');
      await client.send('Browser.setWindowBounds', {
        windowId,
        bounds: {
          windowState: 'normal',
          left: 120,
          top: 80,
          width: 1200,
          height: 850
        }
      });
      await page.bringToFront?.();
      await client.detach?.();
    } catch (error) {
      if (this.debug) {
        this.logger.warn('WhatsApp browser window restore failed', { error: error.message });
      }
    }
  }
}

module.exports = WhatsAppSessionManager;
