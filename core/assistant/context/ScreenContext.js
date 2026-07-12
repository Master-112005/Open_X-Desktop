'use strict';

class ScreenContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.screen');
    this.priority = Number.isFinite(options.priority) ? options.priority : 140;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    context.context.screen = { ...(context.snapshots.screen || {}) };
    return context;
  }
}

module.exports = ScreenContext;
