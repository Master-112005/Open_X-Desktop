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
  getExtractor(id) { return this.extractors.get(String(id)) || null; }
  getNormalizer(id) { return this.normalizers.get(String(id)) || null; }
  getResolver(id) { return this.resolvers.get(String(id)) || null; }
  getValidator(id) { return this.validators.get(String(id)) || null; }
  getEntityType(id) { return this.entityTypes.get(String(id)) || null; }
  unregisterExtractor(id) { return this.extractors.delete(String(id)); }
  unregisterNormalizer(id) { return this.normalizers.delete(String(id)); }
  unregisterResolver(id) { return this.resolvers.delete(String(id)); }
  unregisterValidator(id) { return this.validators.delete(String(id)); }
  unregisterEntityType(id) { return this.entityTypes.delete(String(id)); }

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
    const counts = {
      extractors: this.extractors.size,
      normalizers: this.normalizers.size,
      resolvers: this.resolvers.size,
      validators: this.validators.size,
      entityTypes: this.entityTypes.size
    };
    this.extractors.clear();
    this.normalizers.clear();
    this.resolvers.clear();
    this.validators.clear();
    this.entityTypes.clear();
    return counts;
  }
}

module.exports = EntityRegistry;
