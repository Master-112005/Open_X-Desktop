'use strict';

const EventEmitter = require('events');

const MEMORY_INTELLIGENCE_EVENTS = Object.freeze({
  INITIALIZED: 'visual-memory.intelligence.initialized',
  SEARCH_STARTED: 'visual-memory.intelligence.search.started',
  SEARCH_COMPLETED: 'visual-memory.intelligence.search.completed',
  SEARCH_FAILED: 'visual-memory.intelligence.search.failed',
  SHUTDOWN: 'visual-memory.intelligence.shutdown'
});

class MemoryIntelligenceEventBus {
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

module.exports = { MEMORY_INTELLIGENCE_EVENTS, MemoryIntelligenceEventBus };
