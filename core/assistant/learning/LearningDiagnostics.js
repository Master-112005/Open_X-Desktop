'use strict';

class LearningDiagnostics {
  constructor() {
    this.learningTime = {};
    this.storageWrites = 0;
    this.patternsDetected = 0;
    this.correctionsLearned = 0;
    this.preferenceUpdates = 0;
    this.warnings = [];
    this.errors = [];
    this.pipelineOrder = [];
    this.memoryUsage = this._memoryUsage();
  }

  time(id, durationMs) { this.learningTime[String(id || '')] = Math.max(0, Number(durationMs) || 0); }
  write(count = 1) { this.storageWrites += Math.max(0, Number(count) || 0); }
  pattern() { this.patternsDetected += 1; }
  correction() { this.correctionsLearned += 1; }
  preference() { this.preferenceUpdates += 1; }
  warn(message, data = {}) { this.warnings.push({ message: String(message || ''), data, timestamp: Date.now() }); }
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
      learningTime: { ...this.learningTime },
      storageWrites: this.storageWrites,
      patternsDetected: this.patternsDetected,
      correctionsLearned: this.correctionsLearned,
      preferenceUpdates: this.preferenceUpdates,
      warnings: this.warnings.slice(),
      errors: this.errors.slice(),
      pipelineOrder: this.pipelineOrder.slice(),
      memoryUsage: this.memoryUsage
    };
  }
}

module.exports = LearningDiagnostics;
