'use strict';

class SystemContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.system');
    this.priority = Number.isFinite(options.priority) ? options.priority : 160;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    context.context.system = {
      os: process.platform,
      ...(context.snapshots.system || {})
    };
    return context;
  }
}

module.exports = SystemContext;
