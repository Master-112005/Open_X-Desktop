'use strict';

class SelectionContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.selection');
    this.priority = Number.isFinite(options.priority) ? options.priority : 210;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    context.context.selections = { ...(context.snapshots.selection || {}) };
    return context;
  }
}

module.exports = SelectionContext;
