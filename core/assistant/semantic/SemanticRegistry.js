'use strict';

const { ConfigurationError } = require('./SemanticErrors');

class SemanticRegistry {
  constructor() {
    this.analyzers = new Map();
  }

  register(analyzer, options = {}) {
    if (!analyzer || typeof analyzer.analyze !== 'function') {
      throw new ConfigurationError('Semantic analyzer must provide analyze(context).');
    }
    const id = String(options.id || analyzer.id || analyzer.name || analyzer.constructor?.name || '').trim();
    if (!id) throw new ConfigurationError('Semantic analyzer id is required.');
    analyzer.id = id;
    if (Number.isFinite(options.priority)) analyzer.priority = Number(options.priority);
    if (options.enabled !== undefined) analyzer.enabled = options.enabled !== false;
    this.analyzers.set(id, analyzer);
    return this;
  }

  unregister(id) {
    return this.analyzers.delete(String(id || '').trim());
  }

  list({ includeDisabled = true } = {}) {
    return [...this.analyzers.values()]
      .filter(analyzer => includeDisabled || analyzer.enabled !== false)
      .sort((left, right) => {
        const priority = (Number(left.priority) || 0) - (Number(right.priority) || 0);
        return priority || String(left.id).localeCompare(String(right.id));
      });
  }

  health() {
    return this.list().map(analyzer => ({
      id: analyzer.id,
      version: analyzer.version,
      priority: analyzer.priority,
      enabled: analyzer.enabled !== false,
      initialized: analyzer.initialized === true
    }));
  }

  clear() {
    const count = this.analyzers.size;
    this.analyzers.clear();
    return count;
  }
}

module.exports = SemanticRegistry;
