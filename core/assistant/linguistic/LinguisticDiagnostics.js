'use strict';

class LinguisticDiagnostics {
  constructor() {
    this.records = [];
    this.startedAt = Date.now();
    this.finishedAt = null;
  }

  record(record = {}) {
    const entry = {
      level: String(record.level || 'info'),
      message: String(record.message || ''),
      analyzerId: String(record.analyzerId || ''),
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

  finish() {
    this.finishedAt = Date.now();
    return this;
  }

  toJSON(limit = 100) {
    this.finish();
    return {
      records: this.list(limit),
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      durationMs: Math.max(0, (this.finishedAt || Date.now()) - this.startedAt)
    };
  }
}

module.exports = LinguisticDiagnostics;
