'use strict';

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
    this.memoryUsage = this._memoryUsage();
  }

  time(id, durationMs) { this.responseGenerationTime[String(id || '')] = Math.max(0, Number(durationMs) || 0); }
  formatter(id) { pushBounded(this.formatterExecution, { id, timestamp: Date.now() }); }
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
      responseGenerationTime: { ...this.responseGenerationTime },
      formatterExecution: this.formatterExecution.slice(),
      warnings: this.warnings.slice(),
      errors: this.errors.slice(),
      pipelineOrder: this.pipelineOrder.slice(),
      memoryUsage: this.memoryUsage
    };
  }
}

module.exports = ResponseDiagnostics;
