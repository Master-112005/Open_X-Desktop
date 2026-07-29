'use strict';

const MAX_DIAGNOSTIC_ITEMS = 100;

function pushBounded(list, item) {
  list.push(item);
  if (list.length > MAX_DIAGNOSTIC_ITEMS) list.splice(0, list.length - MAX_DIAGNOSTIC_ITEMS);
}

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
    this.finishedMemoryUsage = null;
    this.reasonerCount = 0;
    this.trimmedCandidates = {};
    this.graphStats = {};
  }

  time(id, durationMs) {
    this.reasoningTime[String(id || '')] = Math.max(0, Number(durationMs) || 0);
  }

  warn(message, data = {}) {
    pushBounded(this.warnings, { message: String(message || ''), data, timestamp: Date.now() });
  }

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

  finish() {
    this.finishedMemoryUsage = this._memoryUsage();
    return this;
  }

  toJSON() {
    this.finish();
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
      reasonerCount: this.reasonerCount,
      trimmedCandidates: { ...this.trimmedCandidates },
      graphStats: { ...this.graphStats },
      cognitiveReasoning: this.cognitiveReasoning || null,
      deliberation: this.deliberation || null,
      memoryUsage: this.memoryUsage,
      finishedMemoryUsage: this.finishedMemoryUsage
    };
  }
}

module.exports = ReasoningDiagnostics;
