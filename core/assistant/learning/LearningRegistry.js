'use strict';

const { ConfigurationError } = require('./LearningErrors');

class LearningRegistry {
  constructor() {
    this.modules = new Map();
  }

  register(module, options = {}) {
    if (!module || typeof module.learn !== 'function') {
      throw new ConfigurationError('Learning module must provide learn(context).');
    }
    const id = String(options.id || module.id || module.constructor?.name || '').trim();
    if (!id) throw new ConfigurationError('Learning module id is required.');
    module.id = id;
    if (Number.isFinite(options.priority)) module.priority = Number(options.priority);
    if (options.enabled !== undefined) module.enabled = options.enabled !== false;
    if (this.modules.has(id) && options.replace !== true) {
      throw new ConfigurationError(`Learning module already registered: ${id}`);
    }
    this.modules.set(id, module);
    return this;
  }

  has(id) { return this.modules.has(String(id || '').trim()); }
  get(id) { return this.modules.get(String(id || '').trim()) || null; }
  count(options = {}) { return this.list(options).length; }
  registerAll(modules = [], options = {}) {
    for (const module of modules) this.register(module, options);
    return this.count({ includeDisabled: true });
  }

  list({ includeDisabled = true } = {}) {
    return [...this.modules.values()]
      .filter(module => includeDisabled || module.enabled !== false)
      .sort((left, right) => (Number(left.priority) || 0) - (Number(right.priority) || 0) || String(left.id).localeCompare(String(right.id)));
  }

  health() {
    return this.list().map(module => (
      typeof module.describe === 'function'
        ? module.describe()
        : {
          id: module.id,
          version: module.version,
          priority: module.priority,
          enabled: module.enabled !== false,
          initialized: module.initialized === true
        }
    ));
  }

  clear() { this.modules.clear(); }
}

module.exports = LearningRegistry;
