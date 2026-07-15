'use strict';

class MemoryIntelligenceDiagnostics {
  constructor({ logger = null, limit = 500 } = {}) {
    this.logger = logger;
    this.limit = Math.max(25, Number(limit || 500));
    this.events = [];
    this.errors = 0;
    this.startedAt = Date.now();
  }

  record(event, details = {}) {
    const entry = { event, details: { ...(details || {}) }, timestamp: new Date().toISOString() };
    this.events.push(entry);
    if (this.events.length > this.limit) this.events.splice(0, this.events.length - this.limit);
    this.logger?.debug?.('[VisualMemoryIntelligence]', entry);
    return entry;
  }

  error(event, error) {
    this.errors += 1;
    const serialized = { name: error?.name || 'Error', message: error?.message || String(error || ''), code: error?.code || '' };
    this.record(event, { level: 'error', error: serialized });
    this.logger?.error?.('[VisualMemoryIntelligence]', serialized);
    return serialized;
  }

  summary() {
    return {
      uptimeMs: Date.now() - this.startedAt,
      events: this.events.length,
      errors: this.errors,
      recent: this.events.slice(-25)
    };
  }
}

module.exports = MemoryIntelligenceDiagnostics;
