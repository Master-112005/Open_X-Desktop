'use strict';

class DesktopContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.desktop');
    this.priority = Number.isFinite(options.priority) ? options.priority : 120;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    context.context.desktopState = {
      ...(context.snapshots.desktop || {}),
      openFolders: Array.isArray(context.snapshots.openFolders) ? context.snapshots.openFolders.slice() : []
    };
    return context;
  }
}

module.exports = DesktopContext;
