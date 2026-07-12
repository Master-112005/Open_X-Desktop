'use strict';

const { AdapterUnavailableError } = require('./AcquisitionErrors');

class InputAdapterRegistry {
  constructor() {
    this.adapters = new Map();
  }

  register(adapter, options = {}) {
    if (!adapter || typeof adapter.acquire !== 'function' || typeof adapter.supports !== 'function') {
      throw new AdapterUnavailableError('Input adapter must implement supports() and acquire().');
    }
    const id = String(options.id || adapter.id || adapter.source || '').trim();
    if (!id) throw new AdapterUnavailableError('Input adapter id is required.');
    adapter.id = id;
    if (Number.isFinite(options.priority)) adapter.priority = Number(options.priority);
    this.adapters.set(id, adapter);
    return this;
  }

  unregister(id) {
    return this.adapters.delete(String(id || '').trim());
  }

  find(sourceOrPayload) {
    const candidates = [...this.adapters.values()]
      .filter(adapter => adapter.supports(sourceOrPayload))
      .sort((left, right) => (Number(right.priority) || 0) - (Number(left.priority) || 0));
    return candidates[0] || null;
  }

  enumerate() {
    return [...this.adapters.values()]
      .sort((left, right) => (Number(right.priority) || 0) - (Number(left.priority) || 0))
      .map(adapter => ({
        id: adapter.id,
        source: adapter.source,
        sourceType: adapter.sourceType,
        priority: adapter.priority,
        capabilities: Array.isArray(adapter.capabilities) ? adapter.capabilities.slice() : [],
        version: adapter.version,
        health: adapter.initialized === false ? 'registered' : 'ready'
      }));
  }
}

module.exports = InputAdapterRegistry;
