'use strict';

class ReasoningDiagnostics {
  constructor() {
    this.reasoningTime = {};
    this.inferenceCount = 0;
    this.goalCandidates = 0;
    this.intentCandidates = 0;
    this.actionCandidates = 0;
    this.conflicts = 0;
    this.clarifications = 0;
    this.confidenceDistribution = [];
    this.warnings = [];
    this.errors = [];
    this.pipelineOrder = [];
    this.memoryUsage = this._memoryUsage();
  }

  time(id, durationMs) {
    this.reasoningTime[String(id || '')] = Math.max(0, Number(durationMs) || 0);
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
      reasoningTime: { ...this.reasoningTime },
      inferenceCount: this.inferenceCount,
      goalCandidates: this.goalCandidates,
      intentCandidates: this.intentCandidates,
      actionCandidates: this.actionCandidates,
      conflicts: this.conflicts,
      clarifications: this.clarifications,
      confidenceDistribution: this.confidenceDistribution.slice(),
      warnings: this.warnings.slice(),
      errors: this.errors.slice(),
      pipelineOrder: this.pipelineOrder.slice(),
      memoryUsage: this.memoryUsage
    };
  }
}

module.exports = ReasoningDiagnostics;
