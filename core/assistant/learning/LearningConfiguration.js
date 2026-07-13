'use strict';

function clampNumber(value, fallback, min, max = Number.POSITIVE_INFINITY) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

const DEFAULT_MODULE_OPTIONS = Object.freeze({ enabled: true, priority: 100, timeoutMs: 250 });

class LearningConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || '12.0.0');
    this.strict = input.strict === true;
    this.minConfidence = clampNumber(input.minConfidence, 0.7, 0, 1);
    this.habitThreshold = clampNumber(input.habitThreshold, 3, 1, 100);
    this.patternThreshold = clampNumber(input.patternThreshold, 5, 1, 100);
    this.workflowThreshold = clampNumber(input.workflowThreshold, 3, 1, 100);
    this.maxRecords = clampNumber(input.maxRecords, 500, 25, 5000);
    this.moduleTimeoutMs = clampNumber(input.moduleTimeoutMs, 250, 25, 10000);
    this.maxEventsPerRun = clampNumber(input.maxEventsPerRun, 100, 1, 1000);
    this.maxDiagnostics = clampNumber(input.maxDiagnostics, 100, 10, 1000);
    this.maxMetadataEntries = clampNumber(input.maxMetadataEntries, 40, 1, 200);
    this.privacy = {
      learnConversationContent: false,
      ...(input.privacy || {})
    };
    this.storage = { ...(input.storage || {}) };
    this.modules = { ...(input.modules || {}) };
    this.clock = typeof input.clock === 'function' ? input.clock : () => new Date().toISOString();
  }

  getModuleOptions(id, defaults = {}) {
    return {
      ...DEFAULT_MODULE_OPTIONS,
      timeoutMs: this.moduleTimeoutMs,
      ...(defaults || {}),
      ...(this.modules[String(id || '')] || {})
    };
  }

  toJSON() {
    return {
      enabled: this.enabled,
      version: this.version,
      strict: this.strict,
      minConfidence: this.minConfidence,
      habitThreshold: this.habitThreshold,
      patternThreshold: this.patternThreshold,
      workflowThreshold: this.workflowThreshold,
      maxRecords: this.maxRecords,
      moduleTimeoutMs: this.moduleTimeoutMs,
      maxEventsPerRun: this.maxEventsPerRun,
      maxDiagnostics: this.maxDiagnostics,
      maxMetadataEntries: this.maxMetadataEntries,
      privacy: { ...this.privacy },
      storage: { ...this.storage }
    };
  }
}

module.exports = LearningConfiguration;
module.exports.DEFAULT_MODULE_OPTIONS = DEFAULT_MODULE_OPTIONS;
