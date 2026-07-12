'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

class DiagnosticRecord {
  constructor({ level = 'info', message = '', code = '', data = {}, timestamp = Date.now() } = {}) {
    this.level = String(level || 'info');
    this.message = String(message || '');
    this.code = String(code || '');
    this.data = { ...(data || {}) };
    this.timestamp = Number(timestamp) || Date.now();
    deepFreeze(this);
  }
}

module.exports = DiagnosticRecord;
