'use strict';

class PipelineConfiguration {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(0, Number(options.timeoutMs)) : 0;
    this.continueOnStageFailure = options.continueOnStageFailure === true;
    this.collectDiagnostics = options.collectDiagnostics !== false;
    this.stages = Array.isArray(options.stages) ? options.stages.slice() : [];
    this.metadata = { ...(options.metadata || {}) };
    Object.freeze(this.stages);
    Object.freeze(this.metadata);
    Object.freeze(this);
  }
}

module.exports = PipelineConfiguration;
