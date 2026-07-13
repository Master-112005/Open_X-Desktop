'use strict';

function numberOrNull(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

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
    const screen = context.snapshots?.screen || {};
    const displays = (Array.isArray(screen.displays) ? screen.displays : [])
      .map(display => ({
        id: display.id || null,
        width: numberOrNull(display.width),
        height: numberOrNull(display.height),
        scaleFactor: numberOrNull(display.scaleFactor),
        primary: Boolean(display.primary)
      }))
      .slice(0, 4);
    context.context.screen = {
      width: numberOrNull(screen.width),
      height: numberOrNull(screen.height),
      scaleFactor: numberOrNull(screen.scaleFactor),
      displays,
      displayCount: displays.length || numberOrNull(screen.displayCount),
      locked: Boolean(screen.locked),
      state: screen.state || (screen.locked ? 'locked' : 'available')
    };
    return context;
  }
}

module.exports = ScreenContext;
