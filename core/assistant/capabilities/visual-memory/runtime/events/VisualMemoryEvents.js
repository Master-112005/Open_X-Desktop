'use strict';

const EventEmitter = require('events');

const VISUAL_MEMORY_EVENTS = Object.freeze({
  INITIALIZED: 'visual-memory.initialized',
  STARTED: 'visual-memory.started',
  PAUSED: 'visual-memory.paused',
  RESUMED: 'visual-memory.resumed',
  STOPPED: 'visual-memory.stopped',
  SHUTDOWN: 'visual-memory.shutdown',
  ERROR: 'visual-memory.error',
  FOLDER_ADDED: 'visual-memory.folder.added',
  FOLDER_REMOVED: 'visual-memory.folder.removed',
  PHOTO_INDEXED: 'visual-memory.photo.indexed',
  THUMBNAIL_GENERATED: 'visual-memory.thumbnail.generated',
  SETTINGS_UPDATED: 'visual-memory.settings.updated',
  PRIVACY_UPDATED: 'visual-memory.privacy.updated'
});

class VisualMemoryEventBus {
  constructor(options = {}) {
    this.emitter = new EventEmitter();
    this.now = options.now || (() => Date.now());
    this.emitter.setMaxListeners(Number(options.maxListeners || 50));
  }

  emit(event, payload = {}) {
    const envelope = Object.freeze({
      event: String(event || ''),
      payload: payload && typeof payload === 'object' ? Object.freeze({ ...payload }) : payload,
      timestamp: this.now()
    });
    this.emitter.listeners(envelope.event).forEach(listener => listener(envelope));
    this.emitter.listeners('*').forEach(listener => listener(envelope));
    return envelope;
  }

  subscribe(event, handler) {
    if (!event || typeof handler !== 'function') return () => false;
    this.emitter.on(event, handler);
    let active = true;
    return () => {
      if (!active) return false;
      active = false;
      this.emitter.off(event, handler);
      return true;
    };
  }
}

module.exports = {
  VISUAL_MEMORY_EVENTS,
  VisualMemoryEventBus
};
