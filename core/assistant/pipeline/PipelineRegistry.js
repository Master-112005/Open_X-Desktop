'use strict';

const { ConfigurationError } = require('./PipelineError');

class PipelineRegistry {
  constructor() {
    this.stages = new Map();
  }

  register(stage, options = {}) {
    if (!stage || typeof stage.execute !== 'function') {
      throw new ConfigurationError('Pipeline stage must provide execute(context).');
    }
    const id = String(options.id || stage.id || stage.name || stage.constructor?.name || '').trim();
    if (!id) throw new ConfigurationError('Pipeline stage id is required.');
    stage.id = id;
    if (options.name) stage.name = String(options.name);
    if (Number.isFinite(options.order)) stage.order = Number(options.order);
    if (options.enabled !== undefined) stage.enabled = options.enabled !== false;
    this.stages.set(id, stage);
    return this;
  }

  unregister(id) {
    return this.stages.delete(String(id || '').trim());
  }

  get(id) {
    return this.stages.get(String(id || '').trim()) || null;
  }

  list({ includeDisabled = true } = {}) {
    return [...this.stages.values()]
      .filter(stage => includeDisabled || stage.enabled !== false)
      .sort((left, right) => (Number(left.order) || 0) - (Number(right.order) || 0));
  }

  clear() {
    const count = this.stages.size;
    this.stages.clear();
    return count;
  }
}

module.exports = PipelineRegistry;
