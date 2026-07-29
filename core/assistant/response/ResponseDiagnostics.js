'use strict';

const { sanitizeDetails } = require('../utils/ErrorHelpers');

const MAX_DIAGNOSTIC_ITEMS = 100;

function pushBounded(list, item) {
  list.push(item);
  if (list.length > MAX_DIAGNOSTIC_ITEMS) list.splice(0, list.length - MAX_DIAGNOSTIC_ITEMS);
}

class ResponseDiagnostics {
  constructor() {
    this.responseGenerationTime = {};
    this.formatterExecution = [];
    this.warnings = [];
    this.errors = [];
    this.pipelineOrder = [];
    this.responsePolicy = null;
    this.responseQuality = null;
    this.memoryUsage = this._memoryUsage();
  }

  time(id, durationMs) { this.responseGenerationTime[String(id || '')] = Math.max(0, Number(durationMs) || 0); }
  formatter(id) { pushBounded(this.formatterExecution, { id: String(id || ''), timestamp: Date.now() }); }
  warn(message, data = {}) { pushBounded(this.warnings, { message: String(message || ''), data: sanitizeDetails(data), timestamp: Date.now() }); }
  policy(policy) { this.responsePolicy = sanitizeDetails(policy || null); }
  quality(quality) { this.responseQuality = sanitizeDetails(quality || null); }
  error(error, data = {}) {
    pushBounded(this.errors, {
      name: error?.name || 'Error',
      message: String(error?.message || error || ''),
      stack: error?.stack || '',
      code: error?.code || null,
      data: sanitizeDetails(data),
      timestamp: Date.now()
    });
  }

  summary() {
    const timings = Object.values(this.responseGenerationTime);
    const total = timings.reduce((sum, value) => sum + value, 0);
    return {
      generatorCount: Object.keys(this.responseGenerationTime).length,
      formatterCount: this.formatterExecution.length,
      warningCount: this.warnings.length,
      errorCount: this.errors.length,
      totalDurationMs: Math.round(total * 1000) / 1000
    };
  }

  _memoryUsage() {
    return typeof process !== 'undefined' && typeof process.memoryUsage === 'function'
      ? process.memoryUsage()
      : null;
  }

  toJSON() {
    return {
      responseGenerationTime: { ...this.responseGenerationTime },
      formatterExecution: this.formatterExecution.slice(),
      warnings: this.warnings.slice(),
      errors: this.errors.slice(),
      pipelineOrder: this.pipelineOrder.slice(),
      responsePolicy: sanitizeDetails(this.responsePolicy),
      responseQuality: sanitizeDetails(this.responseQuality),
      memoryUsage: this.memoryUsage,
      summary: this.summary()
    };
  }
}

module.exports = ResponseDiagnostics;
