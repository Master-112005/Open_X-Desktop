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
    if (this.stages.has(id) && options.replace !== true) {
      throw new ConfigurationError(`Pipeline stage already registered: ${id}`);
    }
    stage.id = id;
    if (options.name) stage.name = String(options.name);
    if (Number.isFinite(options.order)) stage.order = Number(options.order);
    if (options.enabled !== undefined) stage.enabled = options.enabled !== false;
    this.stages.set(id, stage);
    return this;
  }

  registerAll(stages = []) {
    for (const item of stages) {
      if (Array.isArray(item)) this.register(item[0], item[1] || {});
      else this.register(item);
    }
    return this;
  }

  unregister(id) {
    return this.stages.delete(String(id || '').trim());
  }

  get(id) {
    return this.stages.get(String(id || '').trim()) || null;
  }

  has(id) {
    return this.stages.has(String(id || '').trim());
  }

  list({ includeDisabled = true } = {}) {
    return [...this.stages.values()]
      .filter(stage => includeDisabled || stage.enabled !== false)
      .sort((left, right) => {
        const order = (Number(left.order) || 0) - (Number(right.order) || 0);
        return order || String(left.id).localeCompare(String(right.id));
      });
  }

  health() {
    return this.list().map(stage => (typeof stage.describe === 'function'
      ? stage.describe()
      : {
        id: stage.id,
        name: stage.name,
        order: stage.order,
        enabled: stage.enabled !== false,
        initialized: stage.initialized === true
      }));
  }

  clear() {
    const count = this.stages.size;
    this.stages.clear();
    return count;
  }

  count() {
    return this.stages.size;
  }
}

module.exports = PipelineRegistry;
