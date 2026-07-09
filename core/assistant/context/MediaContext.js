'use strict';

class MediaContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.media');
    this.priority = Number.isFinite(options.priority) ? options.priority : 180;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    context.context.media = { ...(context.snapshots.media || {}) };
    return context;
  }
}

module.exports = MediaContext;
