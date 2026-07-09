'use strict';

class UserContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.user');
    this.priority = Number.isFinite(options.priority) ? options.priority : 200;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    context.context.user = { ...(context.snapshots.user || {}) };
    return context;
  }
}

module.exports = UserContext;
