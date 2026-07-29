'use strict';

class HomeLearningDiagnostics {
  constructor(options = {}) {
    this.limit = Math.max(20, Number(options.limit || 300));
    this.events = [];
  }

  record(type, details = {}) {
    const event = {
      type: String(type || 'home.event'),
      details: { ...(details || {}) },
      at: new Date().toISOString()
    };
    this.events.push(event);
    if (this.events.length > this.limit) this.events.splice(0, this.events.length - this.limit);
    return event;
  }

  snapshot() {
    return this.events.slice();
  }
}

module.exports = HomeLearningDiagnostics;
