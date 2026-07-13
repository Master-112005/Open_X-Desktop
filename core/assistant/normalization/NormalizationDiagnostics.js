'use strict';

class NormalizationDiagnostics {
  constructor(options = {}) {
    this.records = [];
    this.maxRecords = Math.max(50, Number(options.maxRecords) || 500);
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
    this.records = this.records.slice(-this.maxRecords);
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

  countByLevel() {
    return this.records.reduce((summary, record) => {
      summary[record.level] = (summary[record.level] || 0) + 1;
      return summary;
    }, {});
  }

  snapshot(limit = 100) {
    return {
      total: this.records.length,
      byLevel: this.countByLevel(),
      records: this.list(limit)
    };
  }
}

module.exports = NormalizationDiagnostics;
