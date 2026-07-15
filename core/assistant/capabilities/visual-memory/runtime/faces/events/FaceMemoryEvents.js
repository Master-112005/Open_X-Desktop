'use strict';

const EventEmitter = require('events');

const FACE_MEMORY_EVENTS = Object.freeze({
  INITIALIZED: 'visual-memory.faces.initialized',
  CONSENT_CHANGED: 'visual-memory.faces.consent.changed',
  IDENTITY_CREATED: 'visual-memory.faces.identity.created',
  IDENTITY_MERGED: 'visual-memory.faces.identity.merged',
  IDENTITY_SPLIT: 'visual-memory.faces.identity.split',
  IDENTITY_DELETED: 'visual-memory.faces.identity.deleted',
  UNKNOWN_GROUPED: 'visual-memory.faces.unknown.grouped',
  RESET: 'visual-memory.faces.reset',
  SHUTDOWN: 'visual-memory.faces.shutdown'
});

class FaceMemoryEventBus {
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

module.exports = { FACE_MEMORY_EVENTS, FaceMemoryEventBus };
