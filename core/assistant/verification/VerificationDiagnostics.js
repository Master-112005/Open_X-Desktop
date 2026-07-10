'use strict';

const MAX_DIAGNOSTIC_ITEMS = 100;

function pushBounded(list, item) {
  list.push(item);
  if (list.length > MAX_DIAGNOSTIC_ITEMS) list.splice(0, list.length - MAX_DIAGNOSTIC_ITEMS);
}

class VerificationDiagnostics {
  constructor() {
    this.verificationTime = {};
    this.verificationEvidence = [];
    this.warnings = [];
    this.errors = [];
    this.pipelineOrder = [];
    this.memoryUsage = this._memoryUsage();
  }

  time(id, durationMs) { this.verificationTime[String(id || '')] = Math.max(0, Number(durationMs) || 0); }
  evidence(item) { pushBounded(this.verificationEvidence, item); }
  warn(message, data = {}) { pushBounded(this.warnings, { message: String(message || ''), data, timestamp: Date.now() }); }
  error(error, data = {}) {
    pushBounded(this.errors, {
      name: error?.name || 'Error',
      message: String(error?.message || error || ''),
      stack: error?.stack || '',
      data,
      timestamp: Date.now()
    });
  }

  _memoryUsage() {
    return typeof process !== 'undefined' && typeof process.memoryUsage === 'function'
      ? process.memoryUsage()
      : null;
  }

  toJSON() {
    return {
      verificationTime: { ...this.verificationTime },
      verificationEvidence: this.verificationEvidence.slice(),
      warnings: this.warnings.slice(),
      errors: this.errors.slice(),
      pipelineOrder: this.pipelineOrder.slice(),
      memoryUsage: this.memoryUsage
    };
  }
}

module.exports = VerificationDiagnostics;
