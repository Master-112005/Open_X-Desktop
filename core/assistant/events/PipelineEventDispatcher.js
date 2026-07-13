'use strict';

const EventEmitter = require('events');
const IdGenerator = require('../utils/IdGenerator');
const deepFreeze = require('../utils/ObjectFreeze');
const { serializeError } = require('../utils/ErrorHelpers');
const PipelineEvents = require('./PipelineEvents');

const idGenerator = new IdGenerator({ prefix: 'event' });

function safePayload(value, depth = 0) {
  if (value instanceof Error) return serializeError(value);
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (depth > 4) return '[MaxDepth]';
  if (Array.isArray(value)) return value.slice(0, 100).map(item => safePayload(item, depth + 1));
  const output = {};
  Object.keys(value).slice(0, 100).forEach(key => {
    output[key] = safePayload(value[key], depth + 1);
  });
  return output;
}

class PipelineEventDispatcher extends EventEmitter {
  constructor(options = {}) {
    super();
    this.historyLimit = Number(options.historyLimit) > 0 ? Math.min(5000, Number(options.historyLimit)) : 500;
    this.history = [];
    this.handlerErrors = [];
    this.setMaxListeners(Number(options.maxListeners) > 0 ? Number(options.maxListeners) : 100);
  }

  dispatch(type, payload = {}, metadata = {}) {
    const eventType = String(type || '').trim();
    if (!eventType) {
      throw new Error('Pipeline event type is required.');
    }
    const event = deepFreeze({
      id: idGenerator.next('event'),
      type: eventType,
      known: PipelineEvents.isPipelineEvent(eventType),
      phase: PipelineEvents.phaseOf(eventType),
      payload: safePayload(payload || {}),
      metadata: safePayload(metadata || {}),
      timestamp: Date.now(),
      timestampIso: new Date().toISOString()
    });
    this._remember(event);
    this._emitSafely(eventType, event);
    this._emitSafely('*', event);
    return event;
  }

  publish(type, payload = {}, metadata = {}) {
    return this.dispatch(type, payload, metadata);
  }

  subscribe(type, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Pipeline event handler must be a function.');
    }
    const eventType = String(type || '*').trim() || '*';
    this.on(eventType, handler);
    return () => this.off(eventType, handler);
  }

  waitFor(type, { timeoutMs = 0, predicate = null } = {}) {
    const eventType = String(type || '*').trim() || '*';
    return new Promise((resolve, reject) => {
      let timer = null;
      const unsubscribe = this.subscribe(eventType, event => {
        if (typeof predicate === 'function' && !predicate(event)) return;
        if (timer) clearTimeout(timer);
        unsubscribe();
        resolve(event);
      });
      if (Number(timeoutMs) > 0) {
        timer = setTimeout(() => {
          unsubscribe();
          reject(new Error(`Timed out waiting for pipeline event ${eventType}.`));
        }, Number(timeoutMs));
      }
    });
  }

  getRecentEvents(limit = 50, type = '') {
    const count = Math.max(0, Number(limit) || 0);
    const source = type ? this.history.filter(event => event.type === type) : this.history;
    return count === 0 ? [] : source.slice(-count);
  }

  getHandlerErrors(limit = 25) {
    return this.handlerErrors.slice(-Math.max(1, Number(limit) || 25));
  }

  clearHistory() {
    const count = this.history.length;
    this.history = [];
    this.handlerErrors = [];
    return count;
  }

  _remember(event) {
    this.history.push(event);
    if (this.history.length > this.historyLimit) {
      this.history.splice(0, this.history.length - this.historyLimit);
    }
  }

  _emitSafely(type, event) {
    const listeners = this.listeners(type);
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        this.handlerErrors.push(deepFreeze({
          eventId: event.id,
          eventType: event.type,
          listenerType: type,
          error: serializeError(error),
          timestamp: Date.now()
        }));
        if (this.handlerErrors.length > 100) {
          this.handlerErrors.splice(0, this.handlerErrors.length - 100);
        }
      }
    }
  }
}

module.exports = PipelineEventDispatcher;
