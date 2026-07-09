'use strict';

const NormalizedInput = require('./NormalizedInput');
const NormalizationConfiguration = require('./NormalizationConfiguration');
const IdGenerator = require('../utils/IdGenerator');

const idGenerator = new IdGenerator({ prefix: 'norm' });

class NormalizationContext {
  constructor({ rawUserInput = null, text = '', configuration = {}, metadata = {} } = {}) {
    const config = configuration instanceof NormalizationConfiguration
      ? configuration
      : new NormalizationConfiguration(configuration);
    const rawText = String(rawUserInput?.rawText ?? rawUserInput?.text ?? text ?? '');
    this.rawUserInput = rawUserInput || null;
    this.requestId = String(rawUserInput?.requestId || idGenerator.next('request'));
    this.conversationId = String(rawUserInput?.conversationId || '');
    this.language = rawUserInput?.language ? { ...rawUserInput.language } : null;
    this.locale = String(rawUserInput?.metadata?.locale || rawUserInput?.options?.locale || config.locale);
    this.originalText = rawText;
    this.workingText = rawText;
    this.normalizationHistory = [];
    this.diagnostics = [];
    this.warnings = [];
    this.metadata = {
      ...(metadata || {}),
      source: rawUserInput?.source || 'chat',
      observations: {
        emojis: [],
        numbers: [],
        dates: [],
        times: [],
        units: [],
        languageSegments: []
      }
    };
    this.timing = {
      startedAt: Date.now(),
      finishedAt: null,
      durationMs: 0,
      normalizers: []
    };
    this.configuration = config;
    this.futureExtensions = {};
    this.confidence = Math.max(0, Math.min(1, Number(rawUserInput?.confidence ?? 1)));
  }

  setText(nextText, normalizerId, details = {}) {
    const previous = this.workingText;
    const next = String(nextText ?? '');
    this.workingText = next;
    const changed = previous !== next;
    this.normalizationHistory.push({
      normalizerId: String(normalizerId || 'unknown'),
      changed,
      beforeLength: previous.length,
      afterLength: next.length,
      modifiedCharacters: changed ? Math.abs(previous.length - next.length) : 0,
      details: { ...(details || {}) },
      timestamp: Date.now()
    });
    return this;
  }

  addObservation(type, value) {
    const key = String(type || '');
    if (!Array.isArray(this.metadata.observations[key])) {
      this.metadata.observations[key] = [];
    }
    this.metadata.observations[key].push(value);
    return this;
  }

  addWarning(message, data = {}) {
    this.warnings.push({ message: String(message || ''), data: { ...(data || {}) }, timestamp: Date.now() });
    return this;
  }

  addDiagnostic(record = {}) {
    this.diagnostics.push({
      level: String(record.level || 'info'),
      message: String(record.message || ''),
      normalizerId: String(record.normalizerId || ''),
      data: { ...(record.data || {}) },
      timestamp: Date.now()
    });
    return this;
  }

  recordTiming(normalizerId, durationMs, success = true) {
    this.timing.normalizers.push({
      normalizerId: String(normalizerId || ''),
      durationMs: Math.max(0, Number(durationMs) || 0),
      success: success === true
    });
    return this;
  }

  toNormalizedInput() {
    this.timing.finishedAt = Date.now();
    this.timing.durationMs = Math.max(0, this.timing.finishedAt - this.timing.startedAt);
    return new NormalizedInput({
      originalInput: this.rawUserInput,
      originalText: this.originalText,
      normalizedText: this.workingText,
      language: this.language,
      locale: this.locale,
      normalizationHistory: this.normalizationHistory,
      warnings: this.warnings,
      diagnostics: this.diagnostics,
      metadata: this.metadata,
      timing: this.timing,
      confidence: this.confidence,
      normalizationVersion: this.configuration.version,
      futureExtensions: this.futureExtensions
    });
  }
}

module.exports = NormalizationContext;
