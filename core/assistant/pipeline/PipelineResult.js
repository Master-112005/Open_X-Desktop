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
}

module.exports = PipelineResult;
