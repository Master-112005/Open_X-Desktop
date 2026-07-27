const Logger = require('../assistant/Data').Logger;
const Normalizer = require('../assistant/Data').Normalizer;

const BROWSER_PROCESSES = Object.freeze(['chrome', 'msedge', 'firefox', 'brave', 'opera']);
const MAX_TARGETS = 8;

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

function targetKey(target) {
  return `${target.id}:${target.tabTitle || target.windowTitle || target.processName || ''}`;
}

class RemoteController {
  constructor(config = {}, dependencies = {}) {
    this.logger = new Logger(config?.logging || { level: 'info' });
    this.windows = dependencies.windows;
  }

  listTargets() {
    if (!this.windows) {
      return { success: false, error: 'Window control is unavailable.', data: { targets: [] } };
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

    return {
      success: true,
      data: {
        targets,
        count: targets.length,
        generatedAt: new Date().toISOString()
      }
    };
  }

  sendControl(input = {}) {
    const action = cleanText(input.action || input.command || 'center', 40);
    const definition = this._resolveDefinition(input.targetId || input.target || input.appName);
    if (!definition) {
      return { success: false, error: 'Choose a supported remote target first.', data: { action: 'remote.control' } };
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

    const tabTitle = cleanText(input.tabTitle || '', 160);
    if (tabTitle && BROWSER_PROCESSES.some(name => definition.preferredProcessNames?.includes(name))) {
      this.windows.focusBrowserTab?.(tabTitle, definition.preferredProcessNames);
    }

    const windowName = cleanText(tabTitle || input.windowTitle || definition.windowName || definition.label, 220);
    const result = this.windows.sendKeys(windowName, keys, {
      preferredProcessNames: definition.preferredProcessNames,
      preferredTitleTokens: definition.preferredTitleTokens,
      requireTitleTokenMatch: definition.requireTitleTokenMatch === true
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
        processName: window.processName || '',
        active: true
      });
    }

    return matches;
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
