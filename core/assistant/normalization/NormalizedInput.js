'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

class NormalizedInput {
  constructor({
    originalInput = null,
    originalText = '',
    normalizedText = '',
    language = null,
    locale = 'en-US',
    normalizationHistory = [],
    warnings = [],
    diagnostics = [],
    metadata = {},
    timing = {},
    confidence = 1,
    normalizationVersion = '3.0.0',
    futureExtensions = {}
  } = {}) {
    this.originalInput = originalInput || null;
    this.originalText = String(originalText || '');
    this.normalizedText = String(normalizedText || '');
    this.commandIntentText = String(metadata?.commandIntentText || normalizedText || '').trim();
    this.language = language && typeof language === 'object' ? { ...language } : null;
    this.locale = String(locale || 'en-US');
    this.normalizationHistory = Array.isArray(normalizationHistory) ? normalizationHistory.slice() : [];
    this.warnings = Array.isArray(warnings) ? warnings.slice() : [];
    this.diagnostics = Array.isArray(diagnostics) ? diagnostics.slice() : [];
    this.metadata = { ...(metadata || {}) };
    this.commandTokens = Array.isArray(this.metadata.commandTokens) ? this.metadata.commandTokens.slice() : [];
    this.timing = { ...(timing || {}) };
    this.confidence = Math.max(0, Math.min(1, Number(confidence) || 0));
    this.normalizationVersion = String(normalizationVersion || '3.0.0');
    this.futureExtensions = { ...(futureExtensions || {}) };
    deepFreeze(this);
  }

  isEmpty() {
    return this.normalizedText.trim().length === 0;
  }

  getObservation(type) {
    const key = String(type || '');
    const observations = this.metadata?.observations || {};
    return Array.isArray(observations[key]) ? observations[key].slice() : [];
  }

  toJSON() {
    return {
      originalText: this.originalText,
      normalizedText: this.normalizedText,
      commandIntentText: this.commandIntentText,
      commandTokens: this.commandTokens.slice(),
      language: this.language,
      locale: this.locale,
      confidence: this.confidence,
      normalizationVersion: this.normalizationVersion,
      metadata: this.metadata,
      timing: this.timing,
      warnings: this.warnings,
      diagnostics: this.diagnostics
    };
  }
}

module.exports = NormalizedInput;
