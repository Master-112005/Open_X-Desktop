'use strict';

class GalleryExperienceLifecycle {
  constructor({ events = null, diagnostics = null } = {}) {
    this.events = events;
    this.diagnostics = diagnostics;
    this.state = 'created';
    this.ready = false;
    this.open = false;
  }

  transition(state, details = {}) {
    this.state = state;
    this.ready = ['ready', 'open', 'paused'].includes(state);
    this.open = state === 'open';
    const snapshot = this.getState();
    this.diagnostics?.record?.(`lifecycle-${state}`, details);
    this.events?.emit?.(`visual-memory.gallery.lifecycle.${state}`, { ...snapshot, details });
    return snapshot;
  }

  getState() {
    return { state: this.state, ready: this.ready, open: this.open };
  }
}

module.exports = GalleryExperienceLifecycle;
