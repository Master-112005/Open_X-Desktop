'use strict';

const { sanitizeDetails } = require('./ErrorHelpers');

class PerformanceTracker {
  constructor(options = {}) {
    this.records = [];
    this.maxRecords = Math.max(1, Number(options.maxRecords) || 500);
    this.now = typeof options.now === 'function' ? options.now : Date.now;
  }

  record(name, durationMs, metadata = {}) {
    const record = {
      name: String(name || 'operation'),
      durationMs: Math.max(0, Number(durationMs) || 0),
      metadata: sanitizeDetails(metadata || {}),
      timestamp: this.now()
    };
    this.records.push(record);
    this.records = this.records.slice(-this.maxRecords);
    return record;
  }

  list(limit = 100) {
    return this.records.slice(-Math.max(1, Number(limit) || 100));
  }

  summary(limit = 100) {
    const records = this.list(limit);
    const total = records.reduce((sum, item) => sum + item.durationMs, 0);
    const slowest = records.reduce((max, item) => item.durationMs > (max?.durationMs || -1) ? item : max, null);
    return {
      count: records.length,
      totalDurationMs: Math.round(total * 1000) / 1000,
      averageDurationMs: records.length ? Math.round((total / records.length) * 1000) / 1000 : 0,
      slowest
    };
  }

  clear() {
    const count = this.records.length;
    this.records = [];
    return count;
  }
}

module.exports = PerformanceTracker;
