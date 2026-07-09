'use strict';

const { ConfigurationError } = require('./NormalizationErrors');

class NormalizerRegistry {
  constructor() {
    this.normalizers = new Map();
  }

  register(normalizer, options = {}) {
    if (!normalizer || typeof normalizer.normalize !== 'function') {
      throw new ConfigurationError('Normalizer must provide normalize(context).');
    }
    const id = String(options.id || normalizer.id || normalizer.name || normalizer.constructor?.name || '').trim();
    if (!id) throw new ConfigurationError('Normalizer id is required.');
    normalizer.id = id;
    if (Number.isFinite(options.priority)) normalizer.priority = Number(options.priority);
    if (options.enabled !== undefined) normalizer.enabled = options.enabled !== false;
    this.normalizers.set(id, normalizer);
    return this;
  }

  unregister(id) {
    return this.normalizers.delete(String(id || '').trim());
  }

  get(id) {
    return this.normalizers.get(String(id || '').trim()) || null;
  }

  list({ includeDisabled = true } = {}) {
    return [...this.normalizers.values()]
      .filter(normalizer => includeDisabled || normalizer.enabled !== false)
      .sort((left, right) => {
        const priority = (Number(left.priority) || 0) - (Number(right.priority) || 0);
        return priority || String(left.id).localeCompare(String(right.id));
      });
  }

  health() {
    return this.list().map(normalizer => ({
      id: normalizer.id,
      version: normalizer.version,
      priority: normalizer.priority,
      enabled: normalizer.enabled !== false,
      initialized: normalizer.initialized === true
    }));
  }

  clear() {
    const count = this.normalizers.size;
    this.normalizers.clear();
    return count;
  }
}

module.exports = NormalizerRegistry;
