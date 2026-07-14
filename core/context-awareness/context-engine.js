const Logger = require('../assistant/Data').Logger;
const signals = require('./signals');

const ACTIVITY_HISTORY_LIMIT = 200;
const MAX_TEXT_LENGTH = 260;
const MAX_PATH_LENGTH = 4096;
const MAX_HISTORY_PAYLOAD_KEYS = 24;

function compactText(value, maxLength = MAX_TEXT_LENGTH) {
  const text = String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 3))}...` : text;
}

function safeTimestamp(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeProcessName(value) {
  return compactText(value, 180);
}

function normalizePid(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function processNameFromPayload(payload = {}) {
  return normalizeProcessName(payload.name || payload.app || payload.processName || '');
}

function normalizePayloadForHistory(payload = {}) {
  if (!payload || typeof payload !== 'object') return payload;
  const safe = {};
  Object.entries(payload).slice(0, MAX_HISTORY_PAYLOAD_KEYS).forEach(([key, value]) => {
    if (typeof value === 'string') {
      safe[key] = compactText(value, key.toLowerCase().includes('path') ? MAX_PATH_LENGTH : MAX_TEXT_LENGTH);
    } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      safe[key] = value;
    } else if (Array.isArray(value)) {
      safe[key] = value.slice(0, 20).map(item => (
        typeof item === 'string' ? compactText(item, MAX_TEXT_LENGTH) : item
      ));
    }
  });
  return safe;
}

function normalizeRunningApps(apps = []) {
  const result = [];
  const seen = new Set();
  apps.forEach(app => {
    const name = normalizeProcessName(app);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return;
    seen.add(key);
    result.push(name);
  });
  return result;
}

class ContextEngine {
  constructor(options = {}) {
    this.logger = options.logger || new Logger(options.logging || { level: 'info' });
    this.signals = options.signals || signals;
    this.now = options.now || (() => Date.now());
    this.unsubscribers = [];
    this.subscribers = new Set();
    this.activityHistory = [];
    this.modeHistory = [];
    this.state = {
      activeApp: null,
      activeTitle: '',
      activePath: null,
      activePid: null,
      runningApps: [],
      microphoneActive: false,
      fullscreen: false,
      currentMode: null,
      timestamp: this.now(),
      uninterruptedActivityMs: 0,
      manualFocusRequested: false
    };
  }

  start() {
    if (this.unsubscribers.length > 0) return;

    const events = this.signals.SIGNAL_EVENTS;
    this.unsubscribers = [
      this.signals.subscribe(events.ACTIVE_WINDOW_CHANGED, envelope => this._handleActiveWindow(envelope.payload)),
      this.signals.subscribe(events.PROCESS_STARTED, envelope => this._handleProcessStarted(envelope.payload)),
      this.signals.subscribe(events.PROCESS_STOPPED, envelope => this._handleProcessStopped(envelope.payload)),
      this.signals.subscribe(events.MICROPHONE_ACTIVITY_CHANGED, envelope => this._handleMicrophoneActivityChanged(envelope.payload)),
      this.signals.subscribe(events.MODE_CHANGED, envelope => this.updateMode(envelope.payload?.to ?? envelope.payload?.currentMode))
    ];
  }

  stop() {
    this.unsubscribers.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (error) {
        this.logger.warn('[Context] Failed to remove signal subscription', error.message);
      }
    });
    this.unsubscribers = [];
  }

  subscribe(callback) {
    if (typeof callback !== 'function') {
      return () => {};
    }

    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  update(partial = {}, eventType = 'context-updated') {
    const previousActiveApp = this.state.activeApp;
    const now = this.now();
    const nextTimestamp = safeTimestamp(partial.timestamp, now);
    const normalizedPartial = this._normalizePartial(partial, nextTimestamp);
    const activeAppChanged = Object.prototype.hasOwnProperty.call(normalizedPartial, 'activeApp') && normalizedPartial.activeApp !== previousActiveApp;

    this.state = {
      ...this.state,
      ...normalizedPartial,
      timestamp: nextTimestamp
    };

    if (activeAppChanged) {
      this.state.uninterruptedActivityMs = 0;
    } else if (this.state.activeApp) {
      this.state.uninterruptedActivityMs += Math.max(0, nextTimestamp - (this._lastTimestamp || nextTimestamp));
    }

    this._lastTimestamp = nextTimestamp;
    this._recordActivity(eventType, normalizedPartial);
    this._publish(eventType);
  }

  updateMode(modeStateOrMode) {
    const mode = typeof modeStateOrMode === 'string' || modeStateOrMode === null
      ? modeStateOrMode
      : modeStateOrMode?.currentMode;

    if (mode === this.state.currentMode) {
      return;
    }

    const entry = {
      mode,
      timestamp: this.now()
    };

    this.modeHistory.push(entry);
    if (this.modeHistory.length > ACTIVITY_HISTORY_LIMIT) {
      this.modeHistory.splice(0, this.modeHistory.length - ACTIVITY_HISTORY_LIMIT);
    }

    this.update({ currentMode: mode }, 'mode-updated');
  }

  getSnapshot() {
    return {
      activeApp: this.state.activeApp,
      activeTitle: this.state.activeTitle,
      activePath: this.state.activePath,
      activePid: this.state.activePid,
      runningApps: [...this.state.runningApps],
      microphoneActive: this.state.microphoneActive,
      fullscreen: this.state.fullscreen,
      timestamp: this.state.timestamp,
      currentMode: this.state.currentMode,
      uninterruptedActivityMs: this.state.uninterruptedActivityMs,
      manualFocusRequested: this.state.manualFocusRequested,
      modeHistory: [...this.modeHistory],
      activityHistory: [...this.activityHistory]
    };
  }

  _handleActiveWindow(payload = {}) {
    this.logger.info(`[Context] Active app -> ${payload.app || 'unknown'}`);
    this.update({
      activeApp: payload.app || null,
      activeTitle: payload.title || '',
      activePath: payload.path || null,
      activePid: payload.pid || null,
      fullscreen: Boolean(payload.fullscreen),
      timestamp: payload.timestamp || this.now()
    }, 'active-window');
  }

  _handleProcessStarted(payload = {}) {
    const processName = processNameFromPayload(payload);
    if (!processName) return;

    const runningApps = new Set(this.state.runningApps);
    runningApps.add(processName);
    this.update({ runningApps: Array.from(runningApps) }, 'process-started');
  }

  _handleProcessStopped(payload = {}) {
    const processName = processNameFromPayload(payload);
    if (!processName) return;

    this.update({
      runningApps: this.state.runningApps.filter(app => app.toLowerCase() !== processName.toLowerCase())
    }, 'process-stopped');
  }

  _handleMicrophoneActivityChanged(payload = {}) {
    this.update({
      microphoneActive: Boolean(payload?.active ?? payload?.microphoneActive)
    }, 'microphone-activity');
  }

  _normalizePartial(partial = {}, timestamp = this.now()) {
    const normalized = { ...partial };

    if (Object.prototype.hasOwnProperty.call(normalized, 'activeApp')) {
      normalized.activeApp = compactText(normalized.activeApp) || null;
    }
    if (Object.prototype.hasOwnProperty.call(normalized, 'activeTitle')) {
      normalized.activeTitle = compactText(normalized.activeTitle);
    }
    if (Object.prototype.hasOwnProperty.call(normalized, 'activePath')) {
      normalized.activePath = compactText(normalized.activePath, MAX_PATH_LENGTH) || null;
    }
    if (Object.prototype.hasOwnProperty.call(normalized, 'activePid')) {
      normalized.activePid = normalizePid(normalized.activePid);
    }
    if (Object.prototype.hasOwnProperty.call(normalized, 'runningApps')) {
      normalized.runningApps = normalizeRunningApps(normalized.runningApps);
    }
    if (Object.prototype.hasOwnProperty.call(normalized, 'fullscreen')) {
      normalized.fullscreen = Boolean(normalized.fullscreen);
    }
    if (Object.prototype.hasOwnProperty.call(normalized, 'microphoneActive')) {
      normalized.microphoneActive = Boolean(normalized.microphoneActive);
    }
    normalized.timestamp = timestamp;

    return normalized;
  }

  _recordActivity(eventType, payload) {
    this.activityHistory.push({
      eventType: compactText(eventType, 80) || 'context-updated',
      payload: normalizePayloadForHistory(payload),
      activeApp: this.state.activeApp,
      timestamp: this.state.timestamp
    });

    if (this.activityHistory.length > ACTIVITY_HISTORY_LIMIT) {
      this.activityHistory.splice(0, this.activityHistory.length - ACTIVITY_HISTORY_LIMIT);
    }
  }

  _publish(eventType) {
    const snapshot = this.getSnapshot();
    this.subscribers.forEach(callback => {
      try {
        callback(snapshot, eventType);
      } catch (error) {
        this.logger.warn('[Context] Subscriber failed', error.message);
      }
    });
  }
}

const defaultEngine = new ContextEngine();

module.exports = {
  ACTIVITY_HISTORY_LIMIT,
  MAX_TEXT_LENGTH,
  MAX_PATH_LENGTH,
  ContextEngine,
  processNameFromPayload,
  createEngine: options => new ContextEngine(options),
  start: defaultEngine.start.bind(defaultEngine),
  stop: defaultEngine.stop.bind(defaultEngine),
  update: defaultEngine.update.bind(defaultEngine),
  updateMode: defaultEngine.updateMode.bind(defaultEngine),
  getSnapshot: defaultEngine.getSnapshot.bind(defaultEngine),
  subscribe: defaultEngine.subscribe.bind(defaultEngine)
};
