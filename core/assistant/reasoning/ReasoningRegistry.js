'use strict';

const { ConfigurationError } = require('./ReasoningErrors');

class ReasoningRegistry {
  constructor() {
    this.reasoners = new Map();
  }

  register(reasoner, options = {}) {
    if (!reasoner || typeof reasoner.reason !== 'function') {
      throw new ConfigurationError('Reasoner must provide reason(context).');
    }
    const id = String(options.id || reasoner.id || reasoner.constructor?.name || '').trim();
    if (!id) throw new ConfigurationError('Reasoner id is required.');
    reasoner.id = id;
    if (Number.isFinite(options.priority)) reasoner.priority = Number(options.priority);
    if (options.enabled !== undefined) reasoner.enabled = options.enabled !== false;
    this.reasoners.set(id, reasoner);
    return this;
  }

  list({ includeDisabled = true } = {}) {
    return [...this.reasoners.values()]
      .filter(reasoner => includeDisabled || reasoner.enabled !== false)
      .sort((left, right) => (Number(left.priority) || 0) - (Number(right.priority) || 0) || String(left.id).localeCompare(String(right.id)));
  }

  health() {
    return this.list().map(reasoner => ({
      id: reasoner.id,
      version: reasoner.version,
      priority: reasoner.priority,
      enabled: reasoner.enabled !== false,
      initialized: reasoner.initialized === true
    }));
  }

  clear() {
    this.reasoners.clear();
  }
}

module.exports = ReasoningRegistry;
