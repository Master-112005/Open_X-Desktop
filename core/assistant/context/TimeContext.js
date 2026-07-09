'use strict';

class TimeContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.time');
    this.priority = Number.isFinite(options.priority) ? options.priority : 190;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
    this.now = options.now || (() => new Date());
  }

  initialize() { this.initialized = true; }

  collect(context) {
    const now = this.now();
    context.context.time = {
      currentTime: now.toISOString(),
      timeZone: globalThis.Intl?.DateTimeFormat().resolvedOptions().timeZone || '',
      date: now.toISOString().slice(0, 10),
      relativeTime: 'now'
    };
    return context;
  }
}

module.exports = TimeContext;
