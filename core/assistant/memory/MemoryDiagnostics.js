'use strict';

const DEFAULT_MAX_DIAGNOSTIC_ITEMS = 100;

function pushBounded(list, item, limit = DEFAULT_MAX_DIAGNOSTIC_ITEMS) {
  list.push(item);
  if (list.length > limit) list.splice(0, list.length - limit);
}

class MemoryDiagnostics {
  constructor(options = {}) {
    this.limit = Math.max(25, Number(options.limit) || DEFAULT_MAX_DIAGNOSTIC_ITEMS);
    this.resolutionTime = {};
    this.referenceResolutionSuccess = {};
    this.contextProvidersExecuted = [];
    this.cacheStatistics = {};
    this.warnings = [];
    this.errors = [];
    this.pipelineOrder = [];
    this.memoryUsage = this._memoryUsage();
  }

  time(id, durationMs) {
    this.resolutionTime[String(id || '')] = Math.max(0, Number(durationMs) || 0);
  }

  reference(id, success) {
    this.referenceResolutionSuccess[String(id || '')] = Boolean(success);
  }

  provider(id) {
    pushBounded(this.contextProvidersExecuted, String(id || ''), this.limit);
  }

  warn(message, data = {}) {
    pushBounded(this.warnings, { message: String(message || ''), data, timestamp: Date.now() }, this.limit);
  }

  error(error, data = {}) {
    pushBounded(this.errors, {
      name: error?.name || 'Error',
      message: String(error?.message || error || ''),
      stack: error?.stack || '',
      data,
      timestamp: Date.now()
    }, this.limit);
  }

  order(id) {
    pushBounded(this.pipelineOrder, String(id || ''), this.limit);
  }

  _memoryUsage() {
    return typeof process !== 'undefined' && typeof process.memoryUsage === 'function'
      ? process.memoryUsage()
      : null;
  }

  toJSON() {
    return {
      resolutionTime: { ...this.resolutionTime },
      memoryUsage: this.memoryUsage,
      referenceResolutionSuccess: { ...this.referenceResolutionSuccess },
      contextProvidersExecuted: this.contextProvidersExecuted.slice(),
      cacheStatistics: { ...this.cacheStatistics },
      warnings: this.warnings.slice(),
      errors: this.errors.slice(),
      pipelineOrder: this.pipelineOrder.slice()
    };
  }

  summary() {
    return {
      warningCount: this.warnings.length,
      errorCount: this.errors.length,
      providerCount: this.contextProvidersExecuted.length,
      pipelineCount: this.pipelineOrder.length,
      memoryUsage: this.memoryUsage
    };
  }
}

module.exports = MemoryDiagnostics;
