'use strict';

const LinguisticGraph = require('./LinguisticGraph');
const LinguisticConfiguration = require('./LinguisticConfiguration');
const IdGenerator = require('../utils/IdGenerator');

const idGenerator = new IdGenerator({ prefix: 'ling' });

class LinguisticContext {
  constructor({ normalizedInput = null, text = '', configuration = {}, metadata = {} } = {}) {
    const config = configuration instanceof LinguisticConfiguration
      ? configuration
      : new LinguisticConfiguration(configuration);
    const normalizedText = String(normalizedInput?.normalizedText ?? text ?? '');
    this.normalizedInput = normalizedInput || null;
    this.requestId = String(normalizedInput?.originalInput?.requestId || idGenerator.next('request'));
    this.conversationId = String(normalizedInput?.originalInput?.conversationId || '');
    this.originalSentence = String(normalizedInput?.originalText ?? normalizedText);
    this.normalizedSentence = normalizedText;
    this.language = normalizedInput?.language ? { ...normalizedInput.language } : null;
    this.locale = String(normalizedInput?.locale || config.locale);
    this.tokens = [];
    this.sentences = [];
    this.clauses = [];
    this.dependencies = [];
    this.posTags = [];
    this.subjects = [];
    this.verbs = [];
    this.objects = [];
    this.modifiers = [];
    this.negations = [];
    this.pronouns = [];
    this.questions = [];
    this.grammaticalRelationships = [];
    this.diagnostics = [];
    this.warnings = [];
    this.metadata = { ...(metadata || {}) };
    this.configuration = config;
    this.futureExtensions = {};
    this.confidence = Math.max(0, Math.min(1, Number(normalizedInput?.confidence ?? 1)));
    this.timing = {
      startedAt: Date.now(),
      finishedAt: null,
      durationMs: 0,
      analyzers: []
    };
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

  summary() {
    return {
      tokenCount: this.tokens.length,
      sentenceCount: this.sentences.length,
      clauseCount: this.clauses.length,
      dependencyCount: this.dependencies.length,
      questionCount: this.questions.length,
      negationCount: this.negations.length,
      pronounCount: this.pronouns.length
    };
  }

  compact() {
    const uniqueBy = (items, keyFn) => {
      const seen = new Set();
      return (items || []).filter(item => {
        const key = keyFn(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };
    this.dependencies = uniqueBy(this.dependencies, item => `${item.governor}:${item.dependent}:${item.relation}`);
    this.grammaticalRelationships = uniqueBy(this.grammaticalRelationships, item => `${item.type}:${item.from}:${item.to}`);
    this.clauses = this.clauses.slice(0, this.configuration.maxClauses || 32);
    return this;
  }

  toGraph() {
    this.compact();
    this.timing.finishedAt = Date.now();
    this.timing.durationMs = Math.max(0, this.timing.finishedAt - this.timing.startedAt);
    return new LinguisticGraph({
      originalSentence: this.originalSentence,
      normalizedSentence: this.normalizedSentence,
      tokens: this.tokens,
      sentences: this.sentences,
      clauses: this.clauses,
      dependencies: this.dependencies,
      posTags: this.posTags,
      subjects: this.subjects,
      verbs: this.verbs,
      objects: this.objects,
      modifiers: this.modifiers,
      negations: this.negations,
      pronouns: this.pronouns,
      questions: this.questions,
      grammaticalRelationships: this.grammaticalRelationships,
      diagnostics: this.diagnostics.concat(this.warnings.map(warning => ({ level: 'warn', message: warning.message, data: warning.data, timestamp: warning.timestamp }))),
      summary: this.summary(),
      confidence: this.confidence,
      timing: this.timing,
      futureExtensions: this.futureExtensions,
      linguisticVersion: this.configuration.version
    });
  }
}

module.exports = LinguisticContext;
