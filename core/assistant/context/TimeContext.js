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
    const hour = now.getHours();
    const day = now.getDay();
    context.context.time = {
      currentTime: now.toISOString(),
      timeZone: globalThis.Intl?.DateTimeFormat().resolvedOptions().timeZone || '',
      date: now.toISOString().slice(0, 10),
      localHour: hour,
      dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
      isWeekend: day === 0 || day === 6,
      partOfDay: hour < 5 ? 'night'
        : hour < 12 ? 'morning'
          : hour < 17 ? 'afternoon'
            : hour < 21 ? 'evening'
              : 'night',
      relativeTime: 'now',
      timestamp: now.getTime()
    };
    return context;
  }
}

module.exports = TimeContext;
