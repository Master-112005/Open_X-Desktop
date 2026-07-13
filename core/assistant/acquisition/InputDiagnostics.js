'use strict';

const { sanitizeAcquisitionData } = require('./AcquisitionSanitizer');

class InputDiagnostics {
  constructor(options = {}) {
    this.maxRecords = Math.max(1, Number(options.maxDiagnostics) || 500);
    this.records = [];
  }

  record(level, message, data = {}) {
    const entry = {
      level: String(level || 'info'),
      message: String(message || ''),
      data: sanitizeAcquisitionData(data),
      timestamp: Date.now()
    };
    this.records.push(entry);
    if (this.records.length > this.maxRecords) {
      this.records.splice(0, this.records.length - this.maxRecords);
    }
    return entry;
  }

  list(limit = 25) {
    return this.records.slice(-Math.max(1, Number(limit) || 25));
  }

  clear() {
    const count = this.records.length;
    this.records = [];
    return count;
  }
}

module.exports = InputDiagnostics;
