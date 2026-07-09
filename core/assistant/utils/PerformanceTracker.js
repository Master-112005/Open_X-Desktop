'use strict';

class PerformanceTracker {
  constructor() {
    this.records = [];
  }

  record(name, durationMs, metadata = {}) {
    const record = {
      name: String(name || 'operation'),
      durationMs: Math.max(0, Number(durationMs) || 0),
      metadata: { ...(metadata || {}) },
      timestamp: Date.now()
    };
    this.records.push(record);
    this.records = this.records.slice(-500);
    return record;
  }

  list(limit = 100) {
    return this.records.slice(-Math.max(1, Number(limit) || 100));
  }

  clear() {
    const count = this.records.length;
    this.records = [];
    return count;
  }
}

module.exports = PerformanceTracker;
