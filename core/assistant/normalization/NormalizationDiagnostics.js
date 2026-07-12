'use strict';

class NormalizationDiagnostics {
  constructor() {
    this.records = [];
  }

  record(record = {}) {
    const entry = {
      level: String(record.level || 'info'),
      message: String(record.message || ''),
      normalizerId: String(record.normalizerId || ''),
      data: { ...(record.data || {}) },
      timestamp: Date.now()
    };
    this.records.push(entry);
    this.records = this.records.slice(-500);
    return entry;
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

module.exports = NormalizationDiagnostics;
