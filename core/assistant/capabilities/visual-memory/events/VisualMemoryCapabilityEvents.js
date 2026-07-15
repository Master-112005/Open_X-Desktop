'use strict';

const EventEmitter = require('events');

const VISUAL_MEMORY_CAPABILITY_EVENTS = Object.freeze({
  INITIALIZED: 'assistant.capability.visualMemory.initialized',
  REGISTERED: 'assistant.capability.visualMemory.registered',
  ROUTED: 'assistant.capability.visualMemory.routed',
  EXECUTED: 'assistant.capability.visualMemory.executed',
  SESSION_UPDATED: 'assistant.capability.visualMemory.session.updated',
  VERIFICATION_REQUIRED: 'assistant.capability.visualMemory.verification.required',
  ERROR: 'assistant.capability.visualMemory.error',
  SHUTDOWN: 'assistant.capability.visualMemory.shutdown'
});

class VisualMemoryCapabilityEventBus {
  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
  }

  emit(event, payload = {}) {
    const envelope = Object.freeze({ event, payload: { ...(payload || {}) }, timestamp: Date.now() });
    this.emitter.emit(event, envelope);
    this.emitter.emit('*', envelope);
    return envelope;
  }

  subscribe(event, handler) {
    this.emitter.on(event, handler);
    return () => this.emitter.off(event, handler);
  }
}

module.exports = { VISUAL_MEMORY_CAPABILITY_EVENTS, VisualMemoryCapabilityEventBus };
