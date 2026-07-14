const Logger = require('../assistant/Data').Logger;
const signals = require('./signals');

const ACTIVE_WINDOW_POLL_MS = 500;
const DEFAULT_FAILURE_BACKOFF_MS = 2000;
const MAX_FAILURE_BACKOFF_MS = 10000;
const MAX_TEXT_LENGTH = 260;
const MAX_PATH_LENGTH = 4096;

function compactText(value, maxLength = MAX_TEXT_LENGTH) {
  const text = String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 3))}...` : text;
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function normalizeWindow(windowInfo) {
  if (!windowInfo) return null;

  const owner = windowInfo.owner || {};
  const app = compactText(owner.name || windowInfo.app || windowInfo.application || '');
  const title = compactText(windowInfo.title || '');
  const path = compactText(owner.path || windowInfo.path || '', MAX_PATH_LENGTH);

  return {
    app: app || null,
    title,
    path: path || null,
    pid: normalizeNumber(owner.processId || windowInfo.pid || windowInfo.processId),
    handle: normalizeNumber(windowInfo.id || windowInfo.handle || windowInfo.windowHandle),
    fullscreen: Boolean(windowInfo.fullscreen || windowInfo.isFullscreen),
    timestamp: Date.now(),
    source: compactText(windowInfo.source || 'active-win', 80)
  };
}

function windowsAreEqual(left, right) {
  if (!left || !right) return false;
  return (
    left.app === right.app &&
    left.title === right.title &&
    left.path === right.path &&
    left.pid === right.pid &&
    left.handle === right.handle &&
    left.fullscreen === right.fullscreen
  );
}

class ActiveWindowMonitor {
  constructor(options = {}) {
    this.intervalMs = this._normalizeInterval(options.intervalMs);
    this.failureBackoffMs = this._normalizeBackoff(options.failureBackoffMs);
    this.maxFailureBackoffMs = this._normalizeBackoff(options.maxFailureBackoffMs, MAX_FAILURE_BACKOFF_MS);
    this.logger = options.logger || new Logger(options.logging || { level: 'info' });
    this.signals = options.signals || signals;
    this.activeWin = options.activeWin || null;
    this.reader = options.reader || null;
    this.now = options.now || (() => Date.now());
    this.timer = null;
    this.currentWindow = null;
    this.subscribers = new Set();
    this.isPolling = false;
    this.consecutiveFailures = 0;
    this.nextAllowedPollAt = 0;
    this.lastFailureMessage = '';
  }

  async _loadActiveWin() {
    if (this.activeWin) return this.activeWin;
    const imported = await import('active-win');
    this.activeWin = imported.default || imported;
    return this.activeWin;
  }

  async _readActiveWindow() {
    if (typeof this.reader === 'function') {
      return normalizeWindow(await this.reader());
    }

    const activeWin = await this._loadActiveWin();
    const reader = typeof activeWin === 'function' ? activeWin : activeWin.activeWindow;
    if (typeof reader !== 'function') {
      throw new Error('active-win did not expose a foreground window reader');
    }

    return normalizeWindow(await reader());
  }

  async pollOnce() {
    const startedAt = this.now();
    if (startedAt < this.nextAllowedPollAt) {
      return this.currentWindow;
    }

    if (this.isPolling) return this.currentWindow;
    this.isPolling = true;

    try {
      const nextWindow = await this._readActiveWindow();
      this._markPollSuccess();
      if (nextWindow && !windowsAreEqual(this.currentWindow, nextWindow)) {
        this.currentWindow = {
          ...nextWindow,
          timestamp: this.now()
        };
        this.logger.info(`[Context] Active window changed -> ${nextWindow.app || 'unknown'}`);
        this.signals.emit(signals.SIGNAL_EVENTS.ACTIVE_WINDOW_CHANGED, this.currentWindow);
        this.subscribers.forEach(callback => {
          try {
            callback(this.currentWindow);
          } catch (error) {
            this.logger.warn('[Context] Active window subscriber failed', error.message);
          }
        });
      }
    } catch (err) {
      this._markPollFailure(err);
    } finally {
      this.isPolling = false;
    }

    return this.currentWindow;
  }

  start() {
    if (this.timer) return;

    this.pollOnce();
    this.timer = setInterval(() => {
      this.pollOnce();
    }, this.intervalMs);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isPolling = false;
  }

  getCurrentWindow() {
    return this.currentWindow;
  }

  subscribe(callback) {
    if (typeof callback !== 'function') {
      return () => {};
    }

    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  _markPollSuccess() {
    this.consecutiveFailures = 0;
    this.nextAllowedPollAt = 0;
    this.lastFailureMessage = '';
  }

  _markPollFailure(error) {
    const message = error?.message || 'unknown error';
    this.consecutiveFailures += 1;
    const backoff = Math.min(
      this.maxFailureBackoffMs,
      this.failureBackoffMs * Math.max(1, this.consecutiveFailures)
    );
    this.nextAllowedPollAt = this.now() + backoff;

    if (message !== this.lastFailureMessage || this.consecutiveFailures === 1) {
      this.logger.warn('[Context] Active window detection failed', message);
      this.lastFailureMessage = message;
    }
  }

  _normalizeInterval(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return ACTIVE_WINDOW_POLL_MS;
    return Math.max(250, Math.min(5000, Math.round(number)));
  }

  _normalizeBackoff(value, fallback = DEFAULT_FAILURE_BACKOFF_MS) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(this.intervalMs || ACTIVE_WINDOW_POLL_MS, Math.min(MAX_FAILURE_BACKOFF_MS, Math.round(number)));
  }
}

const defaultMonitor = new ActiveWindowMonitor();

module.exports = {
  ACTIVE_WINDOW_POLL_MS,
  DEFAULT_FAILURE_BACKOFF_MS,
  MAX_FAILURE_BACKOFF_MS,
  ActiveWindowMonitor,
  normalizeWindow,
  windowsAreEqual,
  createMonitor: options => new ActiveWindowMonitor(options),
  start: defaultMonitor.start.bind(defaultMonitor),
  stop: defaultMonitor.stop.bind(defaultMonitor),
  getCurrentWindow: defaultMonitor.getCurrentWindow.bind(defaultMonitor),
  subscribe: defaultMonitor.subscribe.bind(defaultMonitor)
};
