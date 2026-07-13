'use strict';

const DEFAULT_CONFIGURATION = Object.freeze({
  enabled: true,
  version: '4.0.0',
  locale: 'en-US',
  strict: false,
  analyzers: {}
});

const DEFAULT_ANALYZER_OPTIONS = Object.freeze({
  enabled: true,
  priority: 100,
  strict: false,
  languages: ['*'],
  confidenceThreshold: 0.6,
  grammarRules: {}
});

class LinguisticConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || DEFAULT_CONFIGURATION.version);
    this.locale = String(input.locale || DEFAULT_CONFIGURATION.locale);
    this.strict = input.strict === true;
    this.maxTokens = Number.isFinite(input.maxTokens) ? Math.max(1, Number(input.maxTokens)) : 512;
    this.maxClauses = Number.isFinite(input.maxClauses) ? Math.max(1, Number(input.maxClauses)) : 32;
    this.preserveCommandTargets = input.preserveCommandTargets !== false;
    this.analyzers = { ...(input.analyzers || {}) };
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

  toJSON() {
    return {
      enabled: this.enabled,
      version: this.version,
      locale: this.locale,
      strict: this.strict,
      maxTokens: this.maxTokens,
      maxClauses: this.maxClauses,
      preserveCommandTargets: this.preserveCommandTargets,
      analyzers: { ...this.analyzers }
    };
  }
}

module.exports = LinguisticConfiguration;
