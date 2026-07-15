'use strict';

class GalleryExperienceDiagnostics {
  constructor({ logger = null, maxEvents = 300 } = {}) {
    this.logger = logger;
    this.maxEvents = maxEvents;
    this.events = [];
  }

  record(type, details = {}) {
    const event = { type, details, timestamp: new Date().toISOString() };
    this.events.push(event);
    while (this.events.length > this.maxEvents) this.events.shift();
    this.logger?.debug?.('[GalleryExperience]', type, details);
    return event;
  }

  error(type, error, details = {}) {
    const event = this.record(type, { ...details, error: error?.message || String(error) });
    this.logger?.warn?.('[GalleryExperience]', type, error);
    return event;
  }

  summary() {
    return {
      events: this.events.length,
      lastEvent: this.events[this.events.length - 1] || null,
      errors: this.events.filter(event => event.type.includes('error') || event.details?.error).length
    };
  }
}

module.exports = GalleryExperienceDiagnostics;
