'use strict';

class ClipboardContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.clipboard');
    this.priority = Number.isFinite(options.priority) ? options.priority : 150;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    context.context.clipboard = { ...(context.snapshots.clipboard || {}) };
    return context;
  }
}

module.exports = ClipboardContext;
