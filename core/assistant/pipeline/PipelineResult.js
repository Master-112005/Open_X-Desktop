'use strict';

const deepFreeze = require('../utils/ObjectFreeze');
const { serializeError } = require('../utils/ErrorHelpers');

class PipelineResult {
  constructor({ success = true, cancelled = false, context = null, stageResults = [], output = null, diagnostics = [], timing = {}, error = null } = {}) {
    this.success = success === true;
    this.cancelled = cancelled === true;
    this.context = context;
    this.stageResults = Array.isArray(stageResults) ? stageResults.slice() : [];
    this.output = output;
    this.diagnostics = Array.isArray(diagnostics) ? diagnostics.slice() : [];
    this.timing = { ...(timing || {}) };
    this.error = error ? serializeError(error) : null;
    deepFreeze(this);
  }

  get lastStageResult() {
    return this.stageResults.length ? this.stageResults[this.stageResults.length - 1] : null;
  }

  get failedStageResults() {
    return this.stageResults.filter(result => result.success === false);
  }

  toJSON() {
    return {
      success: this.success,
      cancelled: this.cancelled,
      context: this.context,
      stageResults: this.stageResults,
      output: this.output,
      diagnostics: this.diagnostics,
      timing: this.timing,
      error: this.error
    };
  }
}

module.exports = PipelineResult;
