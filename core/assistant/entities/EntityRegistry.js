'use strict';

const { ConfigurationError } = require('./EntityErrors');

class EntityRegistry {
  constructor() {
    this.extractors = new Map();
    this.normalizers = new Map();
    this.resolvers = new Map();
    this.validators = new Map();
    this.entityTypes = new Map();
  }

  registerExtractor(extractor, options = {}) {
    if (!extractor || typeof extractor.extract !== 'function') {
      throw new ConfigurationError('Entity extractor must provide extract(context).');
    }
    const id = String(options.id || extractor.id || extractor.constructor?.name || '').trim();
    if (!id) throw new ConfigurationError('Entity extractor id is required.');
    extractor.id = id;
    if (Number.isFinite(options.priority)) extractor.priority = Number(options.priority);
    if (options.enabled !== undefined) extractor.enabled = options.enabled !== false;
    this.extractors.set(id, extractor);
    return this;
  }

  registerNormalizer(id, normalizer) { this.normalizers.set(String(id), normalizer); return this; }
  registerResolver(id, resolver) { this.resolvers.set(String(id), resolver); return this; }
  registerValidator(id, validator) { this.validators.set(String(id), validator); return this; }
  registerEntityType(id, definition = {}) { this.entityTypes.set(String(id), { ...(definition || {}) }); return this; }
  unregisterExtractor(id) { return this.extractors.delete(String(id)); }

  listExtractors({ includeDisabled = true } = {}) {
    return [...this.extractors.values()]
      .filter(extractor => includeDisabled || extractor.enabled !== false)
      .sort((left, right) => (Number(left.priority) || 0) - (Number(right.priority) || 0) || String(left.id).localeCompare(String(right.id)));
  }

  health() {
    return this.listExtractors().map(extractor => ({
      id: extractor.id,
      version: extractor.version,
      priority: extractor.priority,
      enabled: extractor.enabled !== false,
      initialized: extractor.initialized === true
    }));
  }

  clear() {
    this.extractors.clear();
    this.normalizers.clear();
    this.resolvers.clear();
    this.validators.clear();
    this.entityTypes.clear();
  }
}

module.exports = EntityRegistry;
