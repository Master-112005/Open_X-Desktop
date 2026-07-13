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
    this.stats = { runs: 0, failures: 0, skips: 0, lastRunAt: null };
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

  supports() {
    return this.enabled;
  }

  markRun(result = {}) {
    this.stats.runs += 1;
    if (result.skipped) this.stats.skips += 1;
    if (result.success === false) this.stats.failures += 1;
    this.stats.lastRunAt = Date.now();
    return this.stats;
  }

  describe() {
    return {
      id: this.id,
      name: this.name,
      order: this.order,
      enabled: this.enabled,
      initialized: this.initialized,
      stats: { ...this.stats }
    };
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
