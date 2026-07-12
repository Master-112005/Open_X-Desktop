'use strict';

const DEFAULT_NORMALIZER_OPTIONS = Object.freeze({
  enabled: true,
  priority: 100,
  strict: false,
  languages: ['*'],
  confidenceThreshold: 0.85,
  dictionaries: {}
});

const DEFAULT_CONFIGURATION = Object.freeze({
  enabled: true,
  version: '3.0.0',
  locale: 'en-US',
  strict: false,
  maxInputLength: 20000,
  normalizers: {}
});

class NormalizationConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || DEFAULT_CONFIGURATION.version);
    this.locale = String(input.locale || DEFAULT_CONFIGURATION.locale);
    this.strict = input.strict === true;
    this.maxInputLength = Number.isFinite(input.maxInputLength)
      ? Math.max(1, Number(input.maxInputLength))
      : DEFAULT_CONFIGURATION.maxInputLength;
    this.normalizers = { ...(input.normalizers || {}) };
  }

  getNormalizerOptions(id, defaults = {}) {
    const configured = this.normalizers[String(id || '')] || {};
    return {
      ...DEFAULT_NORMALIZER_OPTIONS,
      ...(defaults || {}),
      ...(configured || {})
    };
  }

  isEnabled(id) {
    return this.enabled && this.getNormalizerOptions(id).enabled !== false;
  }

  toJSON() {
    return {
      enabled: this.enabled,
      version: this.version,
      locale: this.locale,
      strict: this.strict,
      maxInputLength: this.maxInputLength,
      normalizers: { ...this.normalizers }
    };
  }
}

module.exports = NormalizationConfiguration;
