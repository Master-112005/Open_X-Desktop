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
    this.generators.set(id, generator);
    return this;
  }

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

  clear() { this.generators.clear(); }
}

module.exports = ResponseRegistry;
