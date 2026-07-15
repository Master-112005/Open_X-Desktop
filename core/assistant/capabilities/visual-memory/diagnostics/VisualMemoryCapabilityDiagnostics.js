'use strict';

class VisualMemoryCapabilityDiagnostics {
  constructor({ logger = null, maxEvents = 300 } = {}) {
    this.logger = logger;
    this.maxEvents = maxEvents;
    this.events = [];
  }

  record(type, details = {}) {
    const event = { type, details, timestamp: new Date().toISOString() };
    this.events.push(event);
    while (this.events.length > this.maxEvents) this.events.shift();
    this.logger?.debug?.('[VisualMemoryCapability]', type, details);
    return event;
  }

  error(type, error, details = {}) {
    return this.record(type, { ...details, error: error?.message || String(error) });
  }

  summary() {
    return {
      events: this.events.length,
      errors: this.events.filter(event => event.details?.error || event.type.includes('error')).length,
      lastEvent: this.events[this.events.length - 1] || null
    };
  }
}

module.exports = VisualMemoryCapabilityDiagnostics;
