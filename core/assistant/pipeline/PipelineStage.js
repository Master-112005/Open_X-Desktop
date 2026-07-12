'use strict';

const StageResult = require('./StageResult');
const { ValidationError } = require('./PipelineError');

class PipelineStage {
  constructor({ id = '', name = '', order = 0, enabled = true } = {}) {
    this.id = String(id || name || this.constructor.name);
    this.name = String(name || id || this.constructor.name);
    this.order = Number(order) || 0;
    this.enabled = enabled !== false;
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
    return true;
  }

  validate(context) {
    if (!context || typeof context !== 'object') {
      throw new ValidationError('PipelineContext is required.', { stageId: this.id });
    }
    return true;
  }

  async execute() {
    return StageResult.ok(this.id);
  }

  async cleanup() {
    return true;
  }

  async destroy() {
    this.initialized = false;
    return true;
  }
}

module.exports = PipelineStage;
