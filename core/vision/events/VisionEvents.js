'use strict';

const EventEmitter = require('events');

const VISION_EVENTS = Object.freeze({
  INITIALIZED: 'vision.initialized',
  SHUTDOWN: 'vision.shutdown',
  MODEL_REGISTERED: 'vision.model.registered',
  MODEL_LOADED: 'vision.model.loaded',
  MODEL_UNLOADED: 'vision.model.unloaded',
  INFERENCE_STARTED: 'vision.inference.started',
  INFERENCE_COMPLETED: 'vision.inference.completed',
  INFERENCE_FAILED: 'vision.inference.failed',
  ERROR: 'vision.error'
});

class VisionEventBus {
  constructor(options = {}) {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(Number(options.maxListeners || 50));
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

module.exports = { VISION_EVENTS, VisionEventBus };
