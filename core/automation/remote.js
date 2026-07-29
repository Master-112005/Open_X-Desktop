const Logger = require('../assistant/Data').Logger;
const Normalizer = require('../assistant/Data').Normalizer;

const BROWSER_PROCESSES = Object.freeze(['chrome', 'msedge', 'firefox', 'brave', 'opera']);
const MAX_TARGETS = 8;
const DEFAULT_TARGET_CACHE_TTL_MS = 3000;
const DEFAULT_CONTROL_SETTLE_DELAY_MS = 80;
const REMOTE_ACTION_ALIASES = Object.freeze({
  ok: 'center',
  enter: 'center',
  select: 'center',
  click: 'center',
  tap: 'center',
  playpause: 'playPause',
  play: 'playPause',
  pause: 'playPause',
  resume: 'playPause',
  toggle: 'playPause',
  next: 'next',
  skip: 'next',
  'next song': 'next',
  'next track': 'next',
  'next video': 'next',
  forward: 'right',
  previous: 'previous',
  prev: 'previous',
  'previous song': 'previous',
  'previous track': 'previous',
  'previous video': 'previous',
  rewind: 'seekBack',
  'seek back': 'seekBack',
  'back 10': 'seekBack',
  'forward 10': 'seekForward',
  'seek forward': 'seekForward',
  slideshow: 'slideshow',
  'slide show': 'slideshow',
  present: 'slideshow',
  presentation: 'slideshow',
  end: 'exit',
  stop: 'exit',
  backspace: 'back',
  escape: 'back',
  esc: 'back',
  full: 'fullscreen',
  'full screen': 'fullscreen',
  fs: 'fullscreen'
});

const TARGET_DEFINITIONS = Object.freeze([
  {
    id: 'youtube',
    label: 'YouTube',
    kind: 'media',
    windowName: 'youtube',
    preferredProcessNames: BROWSER_PROCESSES,
    preferredTitleTokens: ['youtube'],
    requireTitleTokenMatch: true,
    aliases: ['yt', 'you tube'],
    controls: {
      up: '{UP}',
      down: '{DOWN}',
      left: '{LEFT}',
      right: '{RIGHT}',
      center: 'k',
      playPause: 'k',
      previous: '+p',
      next: '+n',
      seekBack: 'j',
      seekForward: 'l',
      back: '{ESC}',
      fullscreen: 'f'
    }
  },
  {
    id: 'powerpoint',
    label: 'PowerPoint',
    kind: 'presentation',
    windowName: 'powerpnt',
    preferredProcessNames: ['powerpnt'],
    preferredTitleTokens: ['powerpoint', 'presentation'],
    controls: {
      up: '{UP}',
      down: '{DOWN}',
      left: '{LEFT}',
      right: '{RIGHT}',
      center: '{ENTER}',
      playPause: '{F5}',
      previous: '{PGUP}',
      next: '{PGDN}',
      slideshow: '{F5}',
      exit: '{ESC}',
      back: '{ESC}',
      fullscreen: '{F5}'
    }
  },
  {
    id: 'instagram',
    label: 'Instagram',
    kind: 'social',
    windowName: 'instagram',
    preferredProcessNames: BROWSER_PROCESSES,
    preferredTitleTokens: ['instagram'],
    requireTitleTokenMatch: true,
    aliases: ['insta'],
    controls: {
      up: '{UP}',
      down: '{DOWN}',
      left: '{LEFT}',
      right: '{RIGHT}',
      center: '{ENTER}',
      back: '{ESC}'
    }
  },
  {
    id: 'spotify',
    label: 'Spotify',
    kind: 'media',
    windowName: 'spotify',
    preferredProcessNames: ['spotify'],
    preferredTitleTokens: ['spotify'],
    controls: {
      up: '^{UP}',
      down: '^{DOWN}',
      left: '^{LEFT}',
      right: '^{RIGHT}',
      center: ' ',
      playPause: ' ',
      previous: '^{LEFT}',
      next: '^{RIGHT}',
      back: '{ESC}'
    }
  }
]);

function normalizeText(value) {
  return Normalizer.normalizeText(value || '');
}

function cleanText(value, limit = 160) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function cleanNumber(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function cloneResult(result) {
  return {
    ...result,
    data: {
      ...(result?.data || {}),
      targets: Array.isArray(result?.data?.targets)
        ? result.data.targets.map(target => ({ ...target }))
        : []
    }
  };
}

function normalizeRemoteAction(value) {
  const action = normalizeText(cleanText(value || 'center', 40));
  return REMOTE_ACTION_ALIASES[action] || action;
}

function targetKey(target) {
  return `${target.id}:${target.tabTitle || target.windowTitle || target.processName || ''}`;
}

class RemoteController {
  constructor(config = {}, dependencies = {}) {
    this.logger = new Logger(config?.logging || { level: 'info' });
    this.windows = dependencies.windows;
    this.targetCacheTtlMs = boundedNumber(config?.remote?.targetCacheTtlMs, DEFAULT_TARGET_CACHE_TTL_MS, 500, 10000);
    this.controlSettleDelayMs = boundedNumber(
      config?.remote?.controlSettleDelayMs,
      DEFAULT_CONTROL_SETTLE_DELAY_MS,
      40,
      220
    );
    this.targetCache = { expiresAt: 0, result: null };
  }

  listTargets(options = {}) {
    if (!this.windows) {
      return { success: false, error: 'Window control is unavailable.', data: { targets: [] } };
    }

    const now = Date.now();
    if (options.force !== true && this.targetCache.result && this.targetCache.expiresAt > now) {
      return cloneResult(this.targetCache.result);
    }

    const windows = this._safeListWindows();
    const browserTabs = this._safeListBrowserTabs();
    const targets = [];
    const seen = new Set();

    for (const definition of TARGET_DEFINITIONS) {
      const match = this._matchesForDefinition(definition, windows, browserTabs)
        .sort((a, b) => Number(b.active === true) - Number(a.active === true))[0];
      if (!match) continue;
      const target = {
        id: definition.id,
        label: definition.label,
        kind: definition.kind,
        handle: cleanNumber(match.handle),
        processId: cleanNumber(match.processId || match.id),
        processName: cleanText(match.processName || ''),
        windowTitle: cleanText(match.windowTitle || match.title || ''),
        tabTitle: cleanText(match.tabTitle || ''),
        active: match.active === true,
        source: match.source || 'window'
      };
      const key = targetKey(target);
      if (seen.has(key)) continue;
      seen.add(key);
      targets.push(target);
      if (targets.length >= MAX_TARGETS) break;
    }

    const result = {
      success: true,
      data: {
        targets,
        count: targets.length,
        generatedAt: new Date().toISOString()
      }
    };
    this.targetCache = {
      expiresAt: now + this.targetCacheTtlMs,
      result
    };
    return cloneResult(result);
  }

  sendControl(input = {}) {
    const action = normalizeRemoteAction(input.action || input.command || 'center');
    let target = this._targetFromInput(input);
    let definition = this._resolveDefinition(input.targetId || input.target || input.appName || target?.id);
    if (!definition || this._isCurrentTargetAlias(input.targetId || input.target || input.appName)) {
      target = this._findRemoteTarget(input) || target;
      definition = this._resolveDefinition(target?.id || input.targetId || input.target || input.appName);
    }
    if (!definition) {
      return { success: false, error: 'Choose a supported remote target first.', data: { action: 'remote.control' } };
    }
    if (!target || (!target.handle && !target.tabTitle && !target.windowTitle)) {
      target = this._findRemoteTarget({ ...input, targetId: definition.id });
    }

    const keys = definition.controls[action];
    if (!keys) {
      return {
        success: false,
        error: `${definition.label} does not support ${action} from the remote yet.`,
        data: { action: 'remote.control', targetId: definition.id, command: action }
      };
    }

    if (!this.windows) {
      return { success: false, error: 'Window control is unavailable.', data: { action: 'remote.control' } };
    }

    const tabTitle = cleanText(input.tabTitle || target?.tabTitle || '', 160);
    const isBrowserTarget = BROWSER_PROCESSES.some(name => definition.preferredProcessNames?.includes(name));
    if (tabTitle && isBrowserTarget && target?.active !== true) {
      this.windows.focusBrowserTab?.(tabTitle, definition.preferredProcessNames);
    }

    const windowName = cleanText(tabTitle || input.windowTitle || target?.windowTitle || definition.windowName || definition.label, 220);
    const result = this.windows.sendKeys(windowName, keys, {
      targetHandle: cleanNumber(input.targetHandle || target?.handle),
      targetProcessId: cleanNumber(input.targetProcessId || target?.processId),
      targetTitle: cleanText(input.windowTitle || target?.windowTitle || tabTitle || definition.label, 220),
      targetProcessName: cleanText(input.processName || target?.processName || '', 80),
      preferredProcessNames: definition.preferredProcessNames,
      preferredTitleTokens: definition.preferredTitleTokens,
      requireTitleTokenMatch: definition.requireTitleTokenMatch === true,
      settleDelayMs: this.controlSettleDelayMs
    });

    if (!result?.success) {
      return {
        success: false,
        error: result?.error || `Could not control ${definition.label}.`,
        data: {
          action: 'remote.control',
          targetId: definition.id,
          targetLabel: definition.label,
          command: action,
          keys,
          verified: false
        }
      };
    }

    return {
      success: true,
      data: {
        action: 'remote.control',
        targetId: definition.id,
        targetLabel: definition.label,
        command: action,
        keys,
        matchedWindow: result.data?.matchedWindow || windowName,
        matchedHandle: result.data?.matchedHandle || null,
        processId: result.data?.processId || cleanNumber(input.targetProcessId || target?.processId),
        processName: result.data?.processName || '',
        verified: true
      }
    };
  }

  _safeListWindows() {
    try {
      return this.windows?.listWindows?.() || [];
    } catch (error) {
      this.logger.warn('Remote target window scan failed', { error: error.message });
      return [];
    }
  }

  _safeListBrowserTabs() {
    try {
      return this.windows?.listBrowserTabs?.(BROWSER_PROCESSES) || [];
    } catch (error) {
      this.logger.warn('Remote target browser tab scan failed', { error: error.message });
      return [];
    }
  }

  _matchesForDefinition(definition, windows, browserTabs) {
    const processNames = new Set((definition.preferredProcessNames || []).map(normalizeText));
    const titleTokens = (definition.preferredTitleTokens || []).map(normalizeText).filter(Boolean);
    const processOnly = definition.id === 'powerpoint' || definition.id === 'spotify';
    const matches = [];

    for (const tab of browserTabs) {
      const title = normalizeText(tab.title || tab.rawTitle || '');
      const processName = normalizeText(tab.processName || '');
      if (!processNames.has(processName)) continue;
      if (titleTokens.length && !titleTokens.some(token => title.includes(token))) continue;
      matches.push({
        source: 'browser-tab',
        tabTitle: tab.title || tab.rawTitle || '',
        windowTitle: tab.windowTitle || tab.title || '',
        handle: tab.handle || null,
        processId: tab.processId || tab.id || null,
        processName: tab.processName || '',
        active: tab.isActiveTab === true
      });
    }

    for (const window of windows) {
      const title = normalizeText(window.title || '');
      const processName = normalizeText(window.processName || '');
      const processMatch = processNames.has(processName);
      const titleMatch = titleTokens.length ? titleTokens.some(token => title.includes(token)) : false;
      if (processOnly ? !processMatch : !(processMatch && titleMatch)) continue;
      matches.push({
        source: 'window',
        windowTitle: window.title || '',
        handle: window.handle || null,
        processId: window.processId || window.id || null,
        processName: window.processName || '',
        active: true
      });
    }

    return matches;
  }

  _targetFromInput(input = {}) {
    const targetId = cleanText(input.targetId || input.target || input.appName || '', 40);
    const tabTitle = cleanText(input.tabTitle || '', 160);
    const windowTitle = cleanText(input.windowTitle || '', 220);
    const handle = cleanNumber(input.targetHandle || input.handle || input.matchedHandle);
    const processId = cleanNumber(input.targetProcessId || input.processId);
    if (!targetId && !tabTitle && !windowTitle && !handle) return null;
    return {
      id: targetId,
      label: targetId,
      handle,
      processId,
      processName: cleanText(input.processName || '', 80),
      windowTitle,
      tabTitle,
      active: input.active === true,
      source: tabTitle ? 'browser-tab' : 'window'
    };
  }

  _findRemoteTarget(input = {}) {
    const requested = normalizeText(input.targetId || input.target || input.appName || '');
    const result = this.listTargets();
    const targets = Array.isArray(result?.data?.targets) ? result.data.targets : [];
    if (targets.length === 0) return null;
    if (!requested || this._isCurrentTargetAlias(requested)) {
      return targets.find(target => target.active === true) || targets[0];
    }
    return targets.find(target => {
      const definition = this._resolveDefinition(target.id);
      return requested === normalizeText(target.id) ||
        requested === normalizeText(target.label) ||
        requested === normalizeText(definition?.label) ||
        (definition?.aliases || []).some(alias => requested === normalizeText(alias));
    }) || null;
  }

  _isCurrentTargetAlias(value) {
    return /^(?:current|active|selected|remote|target|app)?$/i.test(cleanText(value || '', 40));
  }

  _resolveDefinition(value) {
    const requested = normalizeText(value);
    if (!requested) return null;
    return TARGET_DEFINITIONS.find(definition => (
      requested === definition.id ||
      requested === normalizeText(definition.label) ||
      (definition.aliases || []).some(alias => requested === normalizeText(alias))
    )) || null;
  }
}

module.exports = RemoteController;
