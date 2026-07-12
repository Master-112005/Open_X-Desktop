'use strict';

const DEFAULT_CONFIGURATION = Object.freeze({
  enabled: true,
  version: '5.0.0',
  locale: 'en-US',
  strict: false,
  confidenceThreshold: 0.55,
  analyzers: {},
  dictionaries: {}
});

const DEFAULT_ANALYZER_OPTIONS = Object.freeze({
  enabled: true,
  priority: 100,
  strict: false,
  languages: ['*'],
  confidenceThreshold: 0.55
});

class SemanticConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || DEFAULT_CONFIGURATION.version);
    this.locale = String(input.locale || DEFAULT_CONFIGURATION.locale);
    this.strict = input.strict === true;
    this.confidenceThreshold = Math.max(0, Math.min(1, Number(input.confidenceThreshold ?? DEFAULT_CONFIGURATION.confidenceThreshold)));
    this.analyzers = { ...(input.analyzers || {}) };
    this.dictionaries = { ...(input.dictionaries || {}) };
    this.providers = { ...(input.providers || {}) };
  }

  getAnalyzerOptions(id, defaults = {}) {
    return {
      ...DEFAULT_ANALYZER_OPTIONS,
      ...(defaults || {}),
      ...(this.analyzers[String(id || '')] || {})
    };
  }

  isEnabled(id) {
    return this.enabled && this.getAnalyzerOptions(id).enabled !== false;
  }
}

module.exports = SemanticConfiguration;
