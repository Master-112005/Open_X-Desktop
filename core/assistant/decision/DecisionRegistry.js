'use strict';

const { ConfigurationError } = require('./DecisionErrors');

class DecisionRegistry {
  constructor() {
    this.decisions = new Map();
  }

  register(decision, options = {}) {
    if (!decision || typeof decision.decide !== 'function') {
      throw new ConfigurationError('Decision component must provide decide(context).');
    }
    const id = String(options.id || decision.id || decision.constructor?.name || '').trim();
    if (!id) throw new ConfigurationError('Decision component id is required.');
    decision.id = id;
    if (Number.isFinite(options.priority)) decision.priority = Number(options.priority);
    if (options.enabled !== undefined) decision.enabled = options.enabled !== false;
    this.decisions.set(id, decision);
    return this;
  }

  get(id) {
    return this.decisions.get(String(id || '').trim()) || null;
  }

  unregister(id) {
    return this.decisions.delete(String(id || '').trim());
  }

  list({ includeDisabled = true } = {}) {
    return [...this.decisions.values()]
      .filter(decision => includeDisabled || decision.enabled !== false)
      .sort((left, right) => (Number(left.priority) || 0) - (Number(right.priority) || 0) || String(left.id).localeCompare(String(right.id)));
  }

  health() {
    return this.list().map(decision => ({
      id: decision.id,
      version: decision.version,
      priority: decision.priority,
      enabled: decision.enabled !== false,
      initialized: decision.initialized === true
    }));
  }

  clear() {
    const count = this.decisions.size;
    this.decisions.clear();
    return count;
  }
}

module.exports = DecisionRegistry;
