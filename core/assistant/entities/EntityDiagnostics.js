'use strict';

class EntityDiagnostics {
  constructor() {
    this.extractionTimes = {};
    this.entitiesDiscovered = {};
    this.relationshipsBuilt = 0;
    this.unknownEntities = [];
    this.duplicateEntities = [];
    this.confidenceDistribution = [];
    this.warnings = [];
    this.errors = [];
    this.pipelineOrder = [];
    this.memoryUsage = this._memoryUsage();
  }

  time(id, durationMs) {
    this.extractionTimes[String(id || '')] = Math.max(0, Number(durationMs) || 0);
  }

  discovered(type) {
    const key = String(type || 'unknown');
    this.entitiesDiscovered[key] = (this.entitiesDiscovered[key] || 0) + 1;
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
      extractionTimes: { ...this.extractionTimes },
      entitiesDiscovered: { ...this.entitiesDiscovered },
      relationshipsBuilt: this.relationshipsBuilt,
      unknownEntities: this.unknownEntities.slice(),
      duplicateEntities: this.duplicateEntities.slice(),
      confidenceDistribution: this.confidenceDistribution.slice(),
      warnings: this.warnings.slice(),
      errors: this.errors.slice(),
      pipelineOrder: this.pipelineOrder.slice(),
      memoryUsage: this.memoryUsage
    };
  }
}

module.exports = EntityDiagnostics;
