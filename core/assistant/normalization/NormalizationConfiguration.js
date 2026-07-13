'use strict';

const DEFAULT_NORMALIZER_OPTIONS = Object.freeze({
  enabled: true,
  priority: 100,
  strict: false,
  languages: ['*'],
  confidenceThreshold: 0.85,
  dictionaries: {},
  observationLimit: 100,
  rewriteText: false
});

const DEFAULT_CONFIGURATION = Object.freeze({
  enabled: true,
  version: '3.0.0',
  locale: 'en-US',
  strict: false,
  maxInputLength: 20000,
  maxHistoryEntries: 200,
  maxDiagnosticEntries: 300,
  maxObservationEntriesPerType: 100,
  normalizerTimeoutMs: 500,
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
    this.maxHistoryEntries = Number.isFinite(input.maxHistoryEntries)
      ? Math.max(10, Number(input.maxHistoryEntries))
      : DEFAULT_CONFIGURATION.maxHistoryEntries;
    this.maxDiagnosticEntries = Number.isFinite(input.maxDiagnosticEntries)
      ? Math.max(10, Number(input.maxDiagnosticEntries))
      : DEFAULT_CONFIGURATION.maxDiagnosticEntries;
    this.maxObservationEntriesPerType = Number.isFinite(input.maxObservationEntriesPerType)
      ? Math.max(10, Number(input.maxObservationEntriesPerType))
      : DEFAULT_CONFIGURATION.maxObservationEntriesPerType;
    this.normalizerTimeoutMs = Number.isFinite(input.normalizerTimeoutMs)
      ? Math.max(10, Number(input.normalizerTimeoutMs))
      : DEFAULT_CONFIGURATION.normalizerTimeoutMs;
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
      maxHistoryEntries: this.maxHistoryEntries,
      maxDiagnosticEntries: this.maxDiagnosticEntries,
      maxObservationEntriesPerType: this.maxObservationEntriesPerType,
      normalizerTimeoutMs: this.normalizerTimeoutMs,
      normalizers: { ...this.normalizers }
    };
  }
}

module.exports = NormalizationConfiguration;
module.exports.DEFAULT_CONFIGURATION = DEFAULT_CONFIGURATION;
module.exports.DEFAULT_NORMALIZER_OPTIONS = DEFAULT_NORMALIZER_OPTIONS;
