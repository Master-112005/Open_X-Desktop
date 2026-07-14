const EventEmitter = require('events');

const MAX_EVENT_NAME_LENGTH = 120;
const DEFAULT_MAX_LISTENERS = 50;
const MAX_PAYLOAD_KEYS = 64;

const SIGNAL_EVENTS = Object.freeze({
  ACTIVE_WINDOW_CHANGED: 'active-window-changed',
  PROCESS_STARTED: 'process-started',
  PROCESS_STOPPED: 'process-stopped',
  MICROPHONE_ACTIVITY_CHANGED: 'microphone-activity-changed',
  MODE_ENTERED: 'mode-entered',
  MODE_EXITED: 'mode-exited',
  MODE_CHANGED: 'mode-changed'
});

const KNOWN_SIGNAL_EVENTS = Object.freeze(new Set([
  ...Object.values(SIGNAL_EVENTS),
  '*'
]));

function compactText(value, maxLength = MAX_EVENT_NAME_LENGTH) {
  const text = String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 3))}...` : text;
}

function normalizeEventName(event) {
  return compactText(event, MAX_EVENT_NAME_LENGTH);
}

function clonePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.slice();
  }

  return Object.fromEntries(Object.entries(payload).slice(0, MAX_PAYLOAD_KEYS));
}

function freezeEnvelope(envelope) {
  if (envelope.payload && typeof envelope.payload === 'object') {
    Object.freeze(envelope.payload);
  }
  return Object.freeze(envelope);
}

class EnvironmentSignals {
  constructor(options = {}) {
    this.emitter = new EventEmitter();
    this.logger = options.logger || null;
    this.now = options.now || (() => Date.now());
    this.maxListeners = Math.max(1, Number(options.maxListeners) || DEFAULT_MAX_LISTENERS);
    this.emitter.setMaxListeners(this.maxListeners);
    this.metrics = {
      emitted: 0,
      dropped: 0,
      subscriberErrors: 0,
      subscriptions: 0,
      unsubscriptions: 0
    };
  }

  emit(event, payload = {}) {
    const eventName = normalizeEventName(event);
    if (!eventName) {
      this.metrics.dropped += 1;
      this._warn('[Context Signals] Dropped signal with empty event name');
      return null;
    }

    const envelope = {
      event: eventName,
      payload: clonePayload(payload),
      timestamp: this.now(),
      known: KNOWN_SIGNAL_EVENTS.has(eventName)
    };
    const frozenEnvelope = freezeEnvelope(envelope);

    this.metrics.emitted += 1;
    this._emitToListeners(eventName, frozenEnvelope);
    if (eventName !== '*') {
      this._emitToListeners('*', frozenEnvelope);
    }
    return frozenEnvelope;
  }

  subscribe(event, callback) {
    const eventName = normalizeEventName(event);
    if (!eventName || typeof callback !== 'function') {
      return () => {};
    }

    const listener = envelope => {
      try {
        callback(envelope);
      } catch (error) {
        this.metrics.subscriberErrors += 1;
        this._warn('[Context Signals] Subscriber failed', error.message);
      }
    };
    this.emitter.on(eventName, listener);
    this.metrics.subscriptions += 1;

    let active = true;
    return () => {
      if (!active) return false;
      active = false;
      this.emitter.off(eventName, listener);
      this.metrics.unsubscriptions += 1;
      return true;
    };
  }

  removeAllListeners() {
    this.emitter.removeAllListeners();
  }

  listenerCount(event = '*') {
    const eventName = normalizeEventName(event);
    return eventName ? this.emitter.listenerCount(eventName) : 0;
  }

  getDiagnostics() {
    return {
      ...this.metrics,
      maxListeners: this.maxListeners,
      activeListeners: this.emitter.eventNames().reduce((total, event) => total + this.emitter.listenerCount(event), 0)
    };
  }

  _emitToListeners(eventName, envelope) {
    this.emitter.listeners(eventName).forEach(listener => listener(envelope));
  }

  _warn(...args) {
    if (this.logger && typeof this.logger.warn === 'function') {
      this.logger.warn(...args);
    }
  }
}

const signals = new EnvironmentSignals();

module.exports = {
  SIGNAL_EVENTS,
  EnvironmentSignals,
  emit: signals.emit.bind(signals),
  subscribe: signals.subscribe.bind(signals),
  removeAllListeners: signals.removeAllListeners.bind(signals),
  listenerCount: signals.listenerCount.bind(signals),
  getDiagnostics: signals.getDiagnostics.bind(signals),
  normalizeEventName,
  signals
};
