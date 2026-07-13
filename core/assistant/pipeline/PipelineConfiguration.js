'use strict';

class PipelineConfiguration {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(0, Number(options.timeoutMs)) : 0;
    this.stageTimeoutMs = Number.isFinite(options.stageTimeoutMs) ? Math.max(0, Number(options.stageTimeoutMs)) : 0;
    this.continueOnStageFailure = options.continueOnStageFailure === true;
    this.collectDiagnostics = options.collectDiagnostics !== false;
    this.collectStageOutputs = options.collectStageOutputs !== false;
    this.maxDiagnostics = Number.isFinite(options.maxDiagnostics) ? Math.max(25, Number(options.maxDiagnostics)) : 500;
    this.maxStageTimings = Number.isFinite(options.maxStageTimings) ? Math.max(10, Number(options.maxStageTimings)) : 100;
    this.maxSharedEntries = Number.isFinite(options.maxSharedEntries) ? Math.max(10, Number(options.maxSharedEntries)) : 200;
    this.stageOptions = { ...(options.stageOptions || {}) };
    this.stages = Array.isArray(options.stages) ? options.stages.slice() : [];
    this.metadata = { ...(options.metadata || {}) };
    Object.freeze(this.stageOptions);
    Object.freeze(this.stages);
    Object.freeze(this.metadata);
    Object.freeze(this);
  }

  optionsForStage(stageId) {
    return { ...(this.stageOptions[String(stageId || '')] || {}) };
  }

  toJSON() {
    return {
      enabled: this.enabled,
      timeoutMs: this.timeoutMs,
      stageTimeoutMs: this.stageTimeoutMs,
      continueOnStageFailure: this.continueOnStageFailure,
      collectDiagnostics: this.collectDiagnostics,
      collectStageOutputs: this.collectStageOutputs,
      maxDiagnostics: this.maxDiagnostics,
      maxStageTimings: this.maxStageTimings,
      maxSharedEntries: this.maxSharedEntries,
      stageOptions: this.stageOptions,
      stages: this.stages,
      metadata: this.metadata
    };
  }
}

module.exports = PipelineConfiguration;
