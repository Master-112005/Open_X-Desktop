'use strict';

class RoutineDiagnostics {
  constructor(options = {}) {
    this.limit = Math.max(20, Number(options.limit || 200));
    this.events = [];
  }

  record(type, details = {}) {
    const event = {
      type: String(type || 'routine.event'),
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

module.exports = RoutineDiagnostics;
