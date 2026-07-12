'use strict';

const SemanticConfiguration = require('./SemanticConfiguration');
const SemanticDictionary = require('./SemanticDictionary');
const SemanticRepresentation = require('./SemanticRepresentation');

class SemanticContext {
  constructor({ linguisticGraph = null, normalizedInput = null, configuration = {}, metadata = {} } = {}) {
    const config = configuration instanceof SemanticConfiguration
      ? configuration
      : new SemanticConfiguration(configuration);
    this.linguisticGraph = linguisticGraph || null;
    this.normalizedInput = normalizedInput || null;
    this.originalInput = normalizedInput?.originalInput || linguisticGraph?.originalInput || null;
    this.configuration = config;
    this.dictionary = new SemanticDictionary({ dictionaries: config.dictionaries });
    this.dictionaryLookups = [];
    this.concepts = [];
    this.semanticRoles = [];
    this.relationships = [];
    this.conversationType = null;
    this.similarityResults = [];
    this.confidenceScores = {};
    this.semanticGraph = null;
    this.diagnostics = [];
    this.warnings = [];
    this.metadata = { ...(metadata || {}) };
    this.futureExtensions = {};
    this.timing = {
      startedAt: Date.now(),
      finishedAt: null,
      durationMs: 0,
      analyzers: []
    };
  }

  addConcept(concept = {}) {
    const id = concept.id || `concept_${this.concepts.length}`;
    const entry = {
      id,
      concept: String(concept.concept || '').toUpperCase(),
      source: concept.source || null,
      tokenId: concept.tokenId || null,
      value: concept.value || '',
      confidence: Math.max(0, Math.min(1, Number(concept.confidence ?? 0.5))),
      metadata: { ...(concept.metadata || {}) }
    };
    if (entry.concept) this.concepts.push(entry);
    return entry;
  }

  addDiagnostic(record = {}) {
    this.diagnostics.push({
      level: String(record.level || 'info'),
      message: String(record.message || ''),
      analyzerId: String(record.analyzerId || ''),
      data: { ...(record.data || {}) },
      timestamp: Date.now()
    });
    return this;
  }

  addWarning(message, data = {}) {
    this.warnings.push({ message: String(message || ''), data: { ...(data || {}) }, timestamp: Date.now() });
    return this;
  }

  recordTiming(analyzerId, durationMs, success = true) {
    this.timing.analyzers.push({
      analyzerId: String(analyzerId || ''),
      durationMs: Math.max(0, Number(durationMs) || 0),
      success: success === true
    });
    return this;
  }

  toRepresentation() {
    this.timing.finishedAt = Date.now();
    this.timing.durationMs = Math.max(0, this.timing.finishedAt - this.timing.startedAt);
    return new SemanticRepresentation({
      originalInput: this.originalInput,
      normalizedInput: this.normalizedInput,
      linguisticGraph: this.linguisticGraph,
      semanticGraph: this.semanticGraph,
      concepts: this.concepts,
      semanticRoles: this.semanticRoles,
      relationships: this.relationships,
      conversationType: this.conversationType,
      similarityResults: this.similarityResults,
      confidenceScores: this.confidenceScores,
      diagnostics: this.diagnostics.concat(this.warnings.map(warning => ({ level: 'warn', message: warning.message, data: warning.data, timestamp: warning.timestamp }))),
      metadata: this.metadata,
      timing: this.timing,
      version: this.configuration.version,
      futureExtensions: this.futureExtensions
    });
  }
}

module.exports = SemanticContext;
