'use strict';

const DEFAULT_EXTRACTOR_OPTIONS = Object.freeze({
  enabled: true,
  priority: 100,
  languages: ['*'],
  confidenceThreshold: 0.45
});

class EntityConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || '6.0.0');
    this.locale = String(input.locale || 'en-US');
    this.strict = input.strict === true;
    this.confidenceThreshold = Math.max(0, Math.min(1, Number(input.confidenceThreshold ?? 0.45)));
    this.extractors = { ...(input.extractors || {}) };
    this.normalizers = { ...(input.normalizers || {}) };
    this.resolvers = { ...(input.resolvers || {}) };
    this.validators = { ...(input.validators || {}) };
    this.entityTypes = { ...(input.entityTypes || {}) };
    this.providers = { ...(input.providers || {}) };
    this.dictionaries = { ...(input.dictionaries || {}) };
  }

  getExtractorOptions(id, defaults = {}) {
    return {
      ...DEFAULT_EXTRACTOR_OPTIONS,
      ...(defaults || {}),
      ...(this.extractors[String(id || '')] || {})
    };
  }

  isExtractorEnabled(id) {
    return this.enabled && this.getExtractorOptions(id).enabled !== false;
  }
}

module.exports = EntityConfiguration;
