'use strict';

class MemoryDiagnostics {
  constructor() {
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
    this.contextProvidersExecuted.push(String(id || ''));
  }

  warn(message, data = {}) {
    this.warnings.push({ message: String(message || ''), data, timestamp: Date.now() });
  }

  error(error, data = {}) {
    this.errors.push({
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
}

module.exports = MemoryDiagnostics;
