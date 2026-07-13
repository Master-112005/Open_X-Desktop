'use strict';

const { ConfigurationError } = require('./ResponseErrors');

class ResponseRegistry {
  constructor() {
    this.generators = new Map();
  }

  register(generator, options = {}) {
    if (!generator || typeof generator.generate !== 'function') {
      throw new ConfigurationError('Response generator must provide generate(context).');
    }
    const id = String(options.id || generator.id || generator.constructor?.name || '').trim();
    if (!id) throw new ConfigurationError('Response generator id is required.');
    generator.id = id;
    if (Number.isFinite(options.priority)) generator.priority = Number(options.priority);
    if (options.enabled !== undefined) generator.enabled = options.enabled !== false;
    if (this.generators.has(id) && options.replace !== true) {
      throw new ConfigurationError(`Response generator already registered: ${id}`);
    }
    this.generators.set(id, generator);
    return this;
  }

  get(id) { return this.generators.get(String(id || '').trim()) || null; }
  unregister(id) { return this.generators.delete(String(id || '').trim()); }
  count() { return this.generators.size; }

  list({ includeDisabled = true } = {}) {
    return [...this.generators.values()]
      .filter(generator => includeDisabled || generator.enabled !== false)
      .sort((left, right) => (Number(left.priority) || 0) - (Number(right.priority) || 0) || String(left.id).localeCompare(String(right.id)));
  }

  health() {
    return this.list().map(generator => ({
      id: generator.id,
      version: generator.version,
      priority: generator.priority,
      enabled: generator.enabled !== false,
      initialized: generator.initialized === true
    }));
  }

  clear() {
    const count = this.generators.size;
    this.generators.clear();
    return count;
  }
}

module.exports = ResponseRegistry;
