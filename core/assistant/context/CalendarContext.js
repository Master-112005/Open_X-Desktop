'use strict';

class CalendarContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.calendar');
    this.priority = Number.isFinite(options.priority) ? options.priority : 170;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    context.context.calendar = { ...(context.snapshots.calendar || {}) };
    return context;
  }
}

module.exports = CalendarContext;
