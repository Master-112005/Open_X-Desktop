'use strict';

const DEFAULT_MODULE_OPTIONS = Object.freeze({ enabled: true, priority: 100 });

class LearningConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || '12.0.0');
    this.strict = input.strict === true;
    this.minConfidence = Number.isFinite(input.minConfidence) ? Number(input.minConfidence) : 0.7;
    this.habitThreshold = Number.isFinite(input.habitThreshold) ? Number(input.habitThreshold) : 3;
    this.patternThreshold = Number.isFinite(input.patternThreshold) ? Number(input.patternThreshold) : 5;
    this.workflowThreshold = Number.isFinite(input.workflowThreshold) ? Number(input.workflowThreshold) : 3;
    this.maxRecords = Number.isFinite(input.maxRecords) ? Number(input.maxRecords) : 500;
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
      ...(defaults || {}),
      ...(this.modules[String(id || '')] || {})
    };
  }
}

module.exports = LearningConfiguration;
