const assert = require('assert');
const EventEmitter = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  CommunicationEngine,
  CommunicationEvents,
  WhatsAppSessionManager,
  WhatsAppProvider,
  WhatsAppSelectors,
  DomSelectorChangedError
} = require('../../core/communication');
const CommunicationsController = require('../../core/automation/communications');

describe('Communication Engine', function() {
  it('delegates message preparation through registered providers', async function() {
    let readyOptions = null;
    let composeOptions = null;
    class FakeProvider extends EventEmitter {
      constructor() {
        super();
        this.id = 'fake';
      }
      async ensureReady(options) {
        readyOptions = options;
      }
      async composeMessage(recipient, message, options) {
        composeOptions = options;
        return { success: true, data: { provider: this.id, recipient, message, delivery: 'draft' } };
      }
      async health() {
        return { provider: this.id, connected: true, state: 'ready' };
      }
      async disconnect() {}
    }

    const engine = new CommunicationEngine({
      config: { communication: { defaultProvider: 'fake', autoStart: false } },
      registerDefaultProviders: false
    });
    engine.registerProvider(new FakeProvider());

    const result = await engine.prepareMessage({
      provider: 'fake',
      recipient: 'Mohit',
      message: 'Hi',
      background: true,
      timeoutMs: 7000
    });

    assert.equal(result.success, true);
    assert.equal(result.data.delivery, 'draft');
    assert.equal(result.data.recipient, 'Mohit');
    assert.deepEqual(readyOptions, { background: true, timeoutMs: 7000 });
    assert.deepEqual(composeOptions.readyOptions, { background: true, timeoutMs: 7000 });
  });

  it('caps WhatsApp message readiness below the assistant command timeout', async function() {
    let request = null;
    const controller = new CommunicationsController({
      communication: { operationTimeoutMs: 60000 },
      communicationEngine: {
        prepareMessage: async options => {
          request = options;
          return { success: false, code: 'WHATSAPP_LOADING', error: 'WhatsApp Web is still loading' };
        }
      }
    });

    const result = await controller.composeMessage('Charan', 'Hi');

    assert.equal(result.success, false);
    assert.equal(request.background, true);
    assert.equal(request.timeoutMs, 8000);
  });

  it('returns duplicate WhatsApp contacts without sending a message', async function() {
    const provider = new WhatsAppProvider({
      session: { on() {}, ensureReady: async () => ({}) }
    });
    provider.searchContacts = async () => ({
      success: true,
      data: {
        contacts: [
          { id: '1', name: 'Mohit Sharma' },
          { id: '2', name: 'Mohit Office' }
        ]
      }
    });

    const result = await provider.composeMessage('Mohit', 'Hi');

    assert.equal(result.success, false);
    assert.equal(result.needsClarification, true);
    assert.equal(result.code, 'DUPLICATE_CONTACTS');
    assert.equal(result.data.choices.length, 2);
    assert.equal(result.data.clarificationType, 'communication.duplicateContacts');
    assert.equal(result.data.choices[0].entities.contactId, '1');
  });

  it('passes a clarified WhatsApp contact id into message preparation', async function() {
    let request = null;
    const controller = new CommunicationsController({
      communication: { operationTimeoutMs: 60000 },
      communicationEngine: {
        prepareMessage: async options => {
          request = options;
          return { success: true, data: { delivery: 'draft' } };
        }
      }
    });

    const result = await controller.composeMessage('Daddy', 'Hi', 'whatsapp', { contactId: 'chat:2:daddy-office' });

    assert.equal(result.success, true);
    assert.equal(request.contactId, 'chat:2:daddy-office');
    assert.equal(request.recipient, 'Daddy');
    assert.equal(request.message, 'Hi');
  });

  it('prepares a WhatsApp draft and emits a confirmation event', async function() {
    const provider = new WhatsAppProvider({
      session: {
        on() {},
        ensureReady: async () => ({}),
        getPage: async () => ({})
      }
    });
    const events = [];
    provider.on(CommunicationEvents.CONFIRMATION_REQUESTED, event => events.push(event));
    provider.searchContacts = async () => ({
      success: true,
      data: {
        contacts: [{ id: '1', name: 'Mohit Sharma' }]
      }
    });
    provider.openConversation = async contact => ({
      success: true,
      data: { contact }
    });
    provider._clearEditable = async () => {};
    provider._waitForMessageBox = async () => ({
      click: async () => {},
      fill: async value => {
        provider.__filled = value;
      }
    });

    const result = await provider.composeMessage('Mohit', 'Hi');

    assert.equal(result.success, true);
    assert.equal(result.data.delivery, 'draft');
    assert.equal(result.data.requiresFinalConfirmation, true);
    assert.equal(provider.__filled, 'Hi');
    assert.ok(result.data.draftId);
    assert.equal(events.length, 1);
    assert.equal(events[0].draftId, result.data.draftId);
    assert.equal(events[0].message, undefined);
  });

  it('restores a pending draft after idle shutdown before sending it', async function() {
    const page = {};
    let restored = 0;
    let sent = 0;
    const provider = new WhatsAppProvider({
      session: {
        on() {},
        isBrowserRunning: () => false,
        ensureReady: async () => page,
        touch() {}
      }
    });
    provider.preparedDrafts.set('draft-1', {
      id: 'draft-1',
      recipient: 'Mohit',
      message: 'Hi',
      contact: { id: 'chat:0:mohit', name: 'Mohit' }
    });
    provider._restoreDraft = async (draft, restoredPage) => {
      restored += 1;
      assert.equal(draft.id, 'draft-1');
      assert.equal(restoredPage, page);
    };
    provider._resolveRequired = async () => ({
      found: true,
      locator: { click: async () => { sent += 1; } }
    });

    const result = await provider.send('draft-1');

    assert.equal(result.success, true);
    assert.equal(restored, 1);
    assert.equal(sent, 1);
    assert.equal(provider.getDraft('draft-1'), null);
  });

  it('closes the WhatsApp session immediately after a prepared message is sent', async function() {
    const page = {};
    let sent = 0;
    const lifecycle = [];
    const provider = new WhatsAppProvider({
      session: {
        on() {},
        isBrowserRunning: () => true,
        ensureReady: async () => page,
        touch: () => lifecycle.push('touch'),
        releaseAfterOperation: async reason => lifecycle.push(`release:${reason}`)
      }
    });
    provider.preparedDrafts.set('draft-1', {
      id: 'draft-1',
      recipient: 'Mohit',
      message: 'Hi',
      contact: { id: 'chat:0:mohit', name: 'Mohit' }
    });
    provider._resolveRequired = async () => ({
      found: true,
      locator: { click: async () => { sent += 1; } }
    });

    const result = await provider.send('draft-1');

    assert.equal(result.success, true);
    assert.equal(sent, 1);
    assert.equal(provider.getDraft('draft-1'), null);
    assert.deepEqual(lifecycle, ['touch', 'release:message-sent']);
  });

  it('cancels an idle WhatsApp draft without recreating the browser and releases the session', async function() {
    const releases = [];
    const provider = new WhatsAppProvider({
      session: {
        on() {},
        isBrowserRunning: () => false,
        getPage: async () => {
          throw new Error('cancel should not recreate an idle browser');
        },
        releaseAfterOperation: async reason => releases.push(reason)
      }
    });
    provider.preparedDrafts.set('draft-1', {
      id: 'draft-1',
      recipient: 'Mohit',
      message: 'Hi',
      contact: { id: 'chat:0:mohit', name: 'Mohit' }
    });

    const result = await provider.cancel('draft-1');

    assert.equal(result.success, true);
    assert.equal(result.data.cancelled, true);
    assert.equal(provider.getDraft('draft-1'), null);
    assert.deepEqual(releases, ['message-cancelled']);
  });

  it('does not autostart WhatsApp before a persistent session exists', async function() {
    let connected = false;
    const provider = new EventEmitter();
    provider.id = 'whatsapp';
    provider.hasPersistentSession = () => false;
    provider.connect = async () => { connected = true; };
    provider.health = async () => ({ provider: 'whatsapp', connected: false, state: 'unknown' });
    provider.disconnect = async () => {};

    const engine = new CommunicationEngine({
      config: { communication: { defaultProvider: 'whatsapp' } },
      registerDefaultProviders: false
    });
    engine.registerProvider(provider);
    await engine.start();

    assert.equal(connected, false);
  });

  it('does not launch a saved WhatsApp browser session during engine startup', async function() {
    let connected = false;
    const provider = new EventEmitter();
    provider.id = 'whatsapp';
    provider.hasPersistentSession = () => true;
    provider.connect = async () => { connected = true; };
    provider.health = async () => ({ provider: 'whatsapp', connected: false, state: 'disconnected', browserRunning: false });
    provider.disconnect = async () => {};

    const engine = new CommunicationEngine({
      config: { communication: { defaultProvider: 'whatsapp' } },
      registerDefaultProviders: false
    });
    engine.registerProvider(provider);
    await engine.start();

    assert.equal(connected, false);
  });

  it('closes idle WhatsApp resources and recreates them for the next request', async function() {
    const timers = [];
    const cleared = new Set();
    const firstContext = new EventEmitter();
    const firstPage = new EventEmitter();
    firstContext.pages = () => [firstPage];
    firstContext.newPage = async () => firstPage;
    firstContext.close = async () => { firstContext.closed = true; firstContext.emit('close'); };
    firstContext.setDefaultTimeout = () => {};
    firstContext.setDefaultNavigationTimeout = () => {};
    firstPage.goto = async () => {};
    const nextContext = new EventEmitter();
    const nextPage = new EventEmitter();
    nextContext.pages = () => [nextPage];
    nextContext.newPage = async () => nextPage;
    nextContext.close = async () => nextContext.emit('close');
    nextContext.setDefaultTimeout = () => {};
    nextContext.setDefaultNavigationTimeout = () => {};
    nextPage.goto = async () => {};

    let launches = 0;
    const session = new WhatsAppSessionManager({
      idleTimeoutMs: 1234,
      setTimeout: (callback, delay) => {
        const timer = { callback, delay, unref() {} };
        timers.push(timer);
        return timer;
      },
      clearTimeout: timer => cleared.add(timer),
      playwright: {
        chromium: {
          launchPersistentContext: async () => {
            launches += 1;
            return launches === 1 ? firstContext : nextContext;
          }
        }
      }
    });
    session.detectState = async () => ({ state: 'CONNECTED' });

    await session.connect();
    session.touch();
    assert.equal(timers.length, 2);
    assert.equal(timers[1].delay, 1234);
    assert.equal(cleared.has(timers[0]), true);

    timers[1].callback();
    await session.idleClosing;
    assert.equal(firstContext.closed, true);
    assert.equal(session.isBrowserRunning(), false);
    assert.equal(firstContext.listenerCount('close'), 0);
    assert.equal(firstPage.listenerCount('crash'), 0);
    assert.equal(firstPage.listenerCount('console'), 0);

    const page = await session.getPage();
    assert.equal(page, nextPage);
    assert.equal(launches, 2);
  });

  it('releases WhatsApp resources immediately after a terminal operation', async function() {
    const logs = [];
    const timers = [];
    const cleared = new Set();
    const context = new EventEmitter();
    const page = new EventEmitter();
    context.pages = () => [page];
    context.newPage = async () => page;
    context.close = async () => {
      context.closed = true;
      context.emit('close');
    };
    context.setDefaultTimeout = () => {};
    context.setDefaultNavigationTimeout = () => {};
    page.goto = async () => {};
    page.close = async () => {
      page.closed = true;
    };

    const session = new WhatsAppSessionManager({
      idleTimeoutMs: 5000,
      setTimeout: (callback, delay) => {
        const timer = { callback, delay, unref() {} };
        timers.push(timer);
        return timer;
      },
      clearTimeout: timer => cleared.add(timer),
      logger: {
        info: (message, data) => logs.push({ message, ...data }),
        warn: (message, data) => logs.push({ message, ...data })
      },
      playwright: {
        chromium: {
          launchPersistentContext: async () => context
        }
      }
    });
    session.detectState = async () => ({ state: 'CONNECTED' });

    await session.connect();
    assert.equal(session.isBrowserRunning(), true);
    assert.equal(timers.length, 1);

    await session.releaseAfterOperation('message-sent');

    assert.equal(page.closed, true);
    assert.equal(context.closed, true);
    assert.equal(session.isBrowserRunning(), false);
    assert.equal(context.listenerCount('close'), 0);
    assert.equal(page.listenerCount('crash'), 0);
    assert.equal(page.listenerCount('console'), 0);
    assert.equal(cleared.has(timers[0]), true);
    assert.ok(logs.some(entry => entry.message === 'Terminal operation release requested' && entry.reason === 'message-sent'));
    assert.ok(logs.some(entry => entry.message === 'Closing page'));
    assert.ok(logs.some(entry => entry.message === 'Closing context'));
    assert.ok(logs.some(entry => entry.message === 'Shutdown complete' && entry.browserRunning === false));
  });

  it('launches visible setup without minimized or off-screen flags', async function() {
    let launchOptions = null;
    const context = new EventEmitter();
    const page = {
      on() {},
      url: () => 'https://web.whatsapp.com/',
      goto: async () => {},
      bringToFront: async () => {},
      waitForSelector: async () => {},
      waitForTimeout: async () => {},
      locator: selector => {
        const visible = /#side|#pane-side|chat-list|#main|conversation-panel|role="application"|Search/i.test(selector);
        return {
          first: () => ({
            count: async () => visible ? 1 : 0,
            isVisible: async () => visible
          })
        };
      }
    };
    context.pages = () => [page];
    context.newPage = async () => page;
    context.close = async () => context.emit('close');
    context.setDefaultTimeout = () => {};
    context.setDefaultNavigationTimeout = () => {};
    context.newCDPSession = async () => ({
      send: async method => method === 'Browser.getWindowForTarget' ? { windowId: 1 } : {},
      detach: async () => {}
    });

    const session = new WhatsAppSessionManager({
      profileDir: __dirname,
      playwright: {
        chromium: {
          launchPersistentContext: async (_profileDir, options) => {
            launchOptions = options;
            return context;
          }
        }
      }
    });

    await session.connect({ visible: true, waitForLogin: true, closeAfterLogin: true, loginTimeoutMs: 1000 });

    assert.equal(launchOptions.headless, false);
    assert.equal(launchOptions.args.includes('--start-minimized'), false);
    assert.equal(launchOptions.args.some(arg => String(arg).startsWith('--window-position=')), false);
    assert.equal(session.lastState, 'CONNECTED');
    assert.equal(session.page, null);
  });

  it('keeps WhatsApp automation headed even when the assistant runs it in the background', async function() {
    let launchOptions = null;
    const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-wa-profile-'));
    fs.writeFileSync(path.join(tempProfile, 'Local State'), '{}');
    const context = new EventEmitter();
    const page = {
      on() {},
      url: () => 'https://web.whatsapp.com/',
      goto: async () => {},
      waitForTimeout: async () => {},
      locator: selector => {
        const visible = /#side|#pane-side|chat-list|#main|conversation-panel|role="application"|Search/i.test(selector);
        return {
          first: () => ({
            count: async () => visible ? 1 : 0,
            isVisible: async () => visible
          })
        };
      }
    };
    context.pages = () => [page];
    context.newPage = async () => page;
    context.close = async () => context.emit('close');
    context.setDefaultTimeout = () => {};
    context.setDefaultNavigationTimeout = () => {};

    try {
      const session = new WhatsAppSessionManager({
        profileDir: tempProfile,
        playwright: {
          chromium: {
            launchPersistentContext: async (_profileDir, options) => {
              launchOptions = options;
              return context;
            }
          }
        }
      });

      await session.ensureReady({ background: true, timeoutMs: 1000 });

    assert.equal(launchOptions.headless, false);
      assert.equal(session.lastState, 'CONNECTED');
    } finally {
      fs.rmSync(tempProfile, { recursive: true, force: true });
    }
  });

  it('reports QR login as its own session state', async function() {
    const page = {
      on() {},
      url: () => 'https://web.whatsapp.com/',
      goto: async () => {},
      waitForTimeout: async () => {},
      locator: selector => ({
        first: () => ({
          count: async () => /qrcode|canvas/i.test(selector) ? 1 : 0,
          isVisible: async () => /qrcode|canvas/i.test(selector)
        })
      })
    };
    const context = new EventEmitter();
    context.pages = () => [page];
    context.newPage = async () => page;
    context.close = async () => context.emit('close');
    context.setDefaultTimeout = () => {};
    context.setDefaultNavigationTimeout = () => {};

    const session = new WhatsAppSessionManager({
      profileDir: __dirname,
      playwright: {
        chromium: {
          launchPersistentContext: async () => context
        }
      }
    });

    await assert.rejects(
      () => session.ensureReady({ timeoutMs: 1000 }),
      error => error.code === 'QR_LOGIN_REQUIRED'
    );
  });

  it('classifies an unknown page and records its inspector data without waiting for selectors', async function() {
    const page = {
      url: () => 'chrome://profile-picker/',
      title: async () => 'Choose your Chrome profile',
      evaluate: async () => ({ readyState: 'complete', htmlLength: 123, visibleText: 'Choose your Chrome profile', forms: [], inputs: [], buttons: [], lists: [], landmarks: [] }),
      locator: () => ({ first: () => ({ count: async () => 0, isVisible: async () => false }) })
    };
    const session = new WhatsAppSessionManager({ page });

    const snapshot = await session.detectState({ includeSnapshot: true });

    assert.equal(snapshot.state, 'UNKNOWN');
    assert.equal(snapshot.inspection.url, 'chrome://profile-picker/');
    assert.equal(snapshot.inspection.readyState, 'complete');
  });

  it('times out a shared WhatsApp startup instead of waiting for the assistant timeout', async function() {
    const timeline = [];
    const session = new WhatsAppSessionManager({
      profileDir: __dirname,
      logger: {
        info: (message, data) => timeline.push({ message, ...data }),
        warn: (message, data) => timeline.push({ message, ...data })
      }
    });
    session.connecting = new Promise(() => {});

    await assert.rejects(
      () => session.ensureReady({ timeoutMs: 1000 }),
      error => error.code === 'BROWSER_STARTING'
    );
    assert.ok(timeline.some(entry => entry.stage === 'wait-for-existing-connection' && entry.message.includes('started')));
    assert.ok(timeline.some(entry => entry.stage === 'wait-for-existing-connection' && entry.message.includes('failed')));
  });

  it('reports a missing search box separately from session readiness', async function() {
    const provider = new WhatsAppProvider({
      session: {
        on() {},
        lastState: 'CONNECTED',
        ensureReady: async () => ({
          keyboard: { press: async () => {}, type: async () => {} },
          waitForTimeout: async () => {},
          locator: () => ({
            first: () => ({
              count: async () => 0,
              isVisible: async () => false
            })
          })
        })
      }
    });

    const result = await provider.searchContacts('Mohit');

    assert.equal(result.success, false);
    assert.equal(result.code, 'SEARCH_BOX_NOT_FOUND');
  });

  it('resolves WhatsApp elements by trying candidates instead of one selector', async function() {
    const calls = [];
    const hidden = {
      first: () => hidden,
      count: async () => 0,
      isVisible: async () => false
    };
    const visible = {
      first: () => visible,
      count: async () => 1,
      isVisible: async () => true
    };
    const page = {
      getByRole: () => {
        calls.push('role');
        return hidden;
      },
      getByPlaceholder: () => {
        calls.push('placeholder');
        return visible;
      },
      getByLabel: () => {
        calls.push('label');
        return hidden;
      },
      getByText: () => {
        calls.push('text');
        return hidden;
      },
      getByTestId: () => {
        calls.push('testid');
        return hidden;
      },
      locator: () => {
        calls.push('locator');
        return hidden;
      }
    };

    const result = await WhatsAppSelectors.resolveElement(page, 'searchBox', { timeoutMs: 1 });

    assert.equal(result.found, true);
    assert.equal(result.strategy, 'placeholder');
    assert.deepEqual(calls, ['role', 'placeholder']);
    assert.equal(result.attempts[0].found, false);
  });

  it('reports missing WhatsApp layout elements in DOM selector errors', function() {
    const error = new DomSelectorChangedError('whatsapp', {
      layout: 'Unsupported Layout',
      pageUrl: 'https://web.whatsapp.com/',
      requiredElements: {
        found: ['sidebar'],
        missing: ['searchBox', 'messageInput']
      },
      diagnostics: {
        files: {
          report: 'OpenX_Data/communication/diagnostics/example.json'
        }
      }
    });

    assert.match(error.message, /Unsupported Layout/);
    assert.match(error.message, /Found: sidebar/);
    assert.match(error.message, /Missing: searchBox, messageInput/);
    assert.match(error.message, /diagnostics/i);
  });

  it('opens conversations through the ready page helper', async function() {
    const provider = new WhatsAppProvider({
      session: {
        on() {},
        ensureReady: async options => ({
          readyOptions: options,
          locator: selector => ({
            nth: index => ({
              click: async () => {
                provider.__clicked = { selector, index };
              }
            })
          })
        })
      }
    });
    provider._waitForMessageBox = async () => ({ click: async () => {} });

    const result = await provider.openConversation({
      id: '1',
      name: 'Mohit',
      selector: '[data-testid="cell-frame-container"]',
      index: 0
    }, { timeoutMs: 5000, background: true });

    assert.equal(result.success, true);
    assert.deepEqual(provider.__clicked, { selector: '[data-testid="cell-frame-container"]', index: 0 });
  });

  it('clicks a semantic search result without converting it to CSS', async function() {
    let clicked = false;
    const provider = new WhatsAppProvider({
      session: {
        on() {},
        ensureReady: async () => ({
          locator: () => { throw new Error('semantic locator was incorrectly treated as CSS'); }
        })
      }
    });
    provider._waitForMessageBox = async () => ({ click: async () => {} });

    const result = await provider.openConversation({
      name: 'Mummy',
      locator: { click: async () => { clicked = true; } },
      locatorSpec: { strategy: 'label', value: /search results|contacts|chats/i }
    });

    assert.equal(result.success, true);
    assert.equal(clicked, true);
  });

  it('uses the page already verified by prepareMessage for contact search', async function() {
    const page = {};
    const provider = new WhatsAppProvider({ session: { on() {}, ensureReady: async () => { throw new Error('should not re-check readiness'); } } });
    provider._resolveRequired = async () => ({ found: true, locator: { click: async () => {}, fill: async () => {} } });
    provider._clearEditable = async () => {};
    provider._readSearchResults = async () => [];

    const result = await provider.searchContacts('Mummy', { page });

    assert.equal(result.success, true);
  });

  it('selects the matching WhatsApp chat row instead of the search-results container', async function() {
    const cell = { click: async () => {} };
    const emptyLocator = { count: async () => 0 };
    const row = {
      isVisible: async () => true,
      textContent: async () => 'MUMMY Yesterday Photo',
      locator: selector => {
        if (selector !== '[data-testid="cell-frame-container"]') return emptyLocator;
        return cell;
      }
    };
    const provider = new WhatsAppProvider({ session: { on() {} } });
    const contacts = await provider._readSearchResults({
      locator: selector => {
        assert.equal(selector, '[role="row"][data-testid^="list-item-"]');
        return { count: async () => 1, nth: () => row };
      }
    }, 'mummy');

    assert.equal(contacts.length, 1);
    assert.equal(contacts[0].locator, cell);
  });

  it('uses the dedicated WhatsApp contact title instead of the full accessibility row text', async function() {
    const cell = { click: async () => {} };
    const title = {
      getAttribute: async attribute => (attribute === 'title' ? 'CHARAN' : ''),
      textContent: async () => 'CHARAN'
    };
    const titleLocator = {
      count: async () => 1,
      nth: () => title
    };
    const emptyLocator = { count: async () => 0 };
    const row = {
      isVisible: async () => true,
      textContent: async () => 'CHARAN Yesterdaywds-ic-readic-imagePhoto',
      locator: selector => {
        if (selector === '[data-testid="cell-frame-title"]') return titleLocator;
        if (selector === '[data-testid="cell-frame-container"]') return cell;
        return emptyLocator;
      }
    };
    const provider = new WhatsAppProvider({ session: { on() {} } });
    const contacts = await provider._readSearchResults({
      locator: selector => {
        assert.equal(selector, '[role="row"][data-testid^="list-item-"]');
        return { count: async () => 1, nth: () => row };
      }
    }, 'charan');

    assert.equal(contacts.length, 1);
    assert.equal(contacts[0].name, 'CHARAN');
    assert.equal(Object.prototype.hasOwnProperty.call(contacts[0], 'rawText'), false);
  });

  it('sanitizes fallback WhatsApp row text before exposing contact choices', async function() {
    const cell = { click: async () => {} };
    const emptyLocator = { count: async () => 0 };
    const row = {
      isVisible: async () => true,
      textContent: async () => 'CHARAN Yesterdaywds-ic-readic-imagePhoto',
      locator: selector => {
        if (selector === '[data-testid="cell-frame-container"]') return cell;
        return emptyLocator;
      }
    };
    const provider = new WhatsAppProvider({ session: { on() {} } });
    const contacts = await provider._readSearchResults({
      locator: selector => {
        assert.equal(selector, '[role="row"][data-testid^="list-item-"]');
        return { count: async () => 1, nth: () => row };
      }
    }, 'charan');

    assert.equal(contacts.length, 1);
    assert.equal(contacts[0].name, 'CHARAN');
  });
});
