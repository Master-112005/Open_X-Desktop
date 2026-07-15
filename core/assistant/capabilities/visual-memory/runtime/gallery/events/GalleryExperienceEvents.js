'use strict';

const EventEmitter = require('events');

const GALLERY_EXPERIENCE_EVENTS = Object.freeze({
  INITIALIZED: 'visual-memory.gallery.initialized',
  OPENED: 'visual-memory.gallery.opened',
  CLOSED: 'visual-memory.gallery.closed',
  VIEW_CHANGED: 'visual-memory.gallery.view.changed',
  SEARCH_RESULTS_OPENED: 'visual-memory.gallery.search.opened',
  SELECTION_CHANGED: 'visual-memory.gallery.selection.changed',
  VIEWER_OPENED: 'visual-memory.gallery.viewer.opened',
  FAVORITE_CHANGED: 'visual-memory.gallery.favorite.changed',
  RECENT_CHANGED: 'visual-memory.gallery.recent.changed',
  ERROR: 'visual-memory.gallery.error',
  SHUTDOWN: 'visual-memory.gallery.shutdown'
});

class GalleryExperienceEventBus {
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

module.exports = { GALLERY_EXPERIENCE_EVENTS, GalleryExperienceEventBus };
