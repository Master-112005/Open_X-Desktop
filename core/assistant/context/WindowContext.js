'use strict';

class WindowContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.window');
    this.priority = Number.isFinite(options.priority) ? options.priority : 220;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    const activeWindow = context.snapshots.activeWindow || null;
    context.context.windows = {
      focusedWindow: activeWindow,
      title: activeWindow?.title || null,
      handle: activeWindow?.handle || null,
      state: activeWindow?.fullscreen ? 'fullscreen' : activeWindow ? 'focused' : 'unknown'
    };
    return context;
  }
}

module.exports = WindowContext;
