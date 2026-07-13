'use strict';

const deepFreeze = require('../utils/ObjectFreeze');
const { sanitizeDetails } = require('../utils/ErrorHelpers');

const LEVELS = new Set(['debug', 'info', 'warn', 'error']);

class DiagnosticRecord {
  constructor({ level = 'info', message = '', code = '', data = {}, timestamp = Date.now() } = {}) {
    const normalizedLevel = String(level || 'info').toLowerCase();
    this.level = LEVELS.has(normalizedLevel) ? normalizedLevel : 'info';
    this.message = String(message || '');
    this.code = String(code || '');
    this.data = sanitizeDetails(data || {});
    this.timestamp = Number(timestamp) || Date.now();
    deepFreeze(this);
  }

  get isError() {
    return this.level === 'error';
  }

  toJSON() {
    return {
      level: this.level,
      message: this.message,
      code: this.code,
      data: this.data,
      timestamp: this.timestamp
    };
  }
}

module.exports = DiagnosticRecord;
