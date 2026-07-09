'use strict';

const IdGenerator = require('../utils/IdGenerator');
const deepFreeze = require('../utils/ObjectFreeze');

const idGenerator = new IdGenerator({ prefix: 'pipe' });

class PipelineContext {
  constructor({ requestId = '', conversationId = '', source = 'chat', rawInput = '', normalizedInput = '', options = {}, metadata = {}, rawUserInput = null } = {}) {
    this.rawUserInput = rawUserInput || null;
    this.requestId = requestId || rawUserInput?.requestId || idGenerator.next('request');
    this.conversationId = conversationId || rawUserInput?.conversationId || '';
    this.timestamp = Date.now();
    this.source = String(source || rawUserInput?.source || 'chat');
    this.rawInput = String(rawInput || rawUserInput?.rawText || '');
    this.normalizedInput = String(normalizedInput || rawInput || rawUserInput?.rawText || '');
    this.normalizedInputObject = null;
    this.linguisticGraph = null;
    this.semanticRepresentation = null;
    this.options = { ...(options || {}) };
    this.metadata = { ...(metadata || {}) };
    this.diagnostics = [];
    this.shared = new Map();
    this.stageOutputs = new Map();
    this.timing = {
      startedAt: this.timestamp,
      finishedAt: null,
      durationMs: 0,
      stages: []
    };
    this.cancelled = false;
    this.cancelReason = '';
    this.input = deepFreeze({
      requestId: this.requestId,
      conversationId: this.conversationId,
      source: this.source,
      rawInput: this.rawInput,
      normalizedInput: this.normalizedInput,
      options: { ...this.options },
      metadata: { ...this.metadata },
      rawUserInput
    });
  }

  set(key, value) {
    this.shared.set(String(key), value);
    return this;
  }

  get(key, fallback = undefined) {
    const normalized = String(key);
    return this.shared.has(normalized) ? this.shared.get(normalized) : fallback;
  }

  setStageOutput(stageId, output) {
    this.stageOutputs.set(String(stageId || ''), output);
    return this;
  }

  addDiagnostic(record = {}) {
    this.diagnostics.push({
      level: String(record.level || 'info'),
      message: String(record.message || ''),
      code: String(record.code || ''),
      data: { ...(record.data || {}) },
      timestamp: Number(record.timestamp) || Date.now()
    });
    return this;
  }

  cancel(reason = 'cancelled') {
    this.cancelled = true;
    this.cancelReason = String(reason || 'cancelled');
    return this;
  }

  toJSON() {
    return {
      requestId: this.requestId,
      conversationId: this.conversationId,
      timestamp: this.timestamp,
      source: this.source,
      rawInput: this.rawInput,
      normalizedInput: this.normalizedInput,
      normalizedInputObject: this.normalizedInputObject ? {
        normalizedText: this.normalizedInputObject.normalizedText,
        language: this.normalizedInputObject.language,
        normalizationVersion: this.normalizedInputObject.normalizationVersion,
        historyCount: this.normalizedInputObject.normalizationHistory?.length || 0
      } : null,
      linguisticGraph: this.linguisticGraph ? {
        normalizedSentence: this.linguisticGraph.normalizedSentence,
        tokenCount: this.linguisticGraph.tokens?.length || 0,
        sentenceCount: this.linguisticGraph.sentences?.length || 0,
        clauseCount: this.linguisticGraph.clauses?.length || 0,
        dependencyCount: this.linguisticGraph.dependencies?.length || 0,
        linguisticVersion: this.linguisticGraph.linguisticVersion
      } : null,
      semanticRepresentation: this.semanticRepresentation ? {
        conceptCount: this.semanticRepresentation.concepts?.length || 0,
        relationshipCount: this.semanticRepresentation.relationships?.length || 0,
        conversationType: this.semanticRepresentation.conversationType?.type || null,
        confidence: this.semanticRepresentation.confidenceScores?.overall || 0,
        version: this.semanticRepresentation.version
      } : null,
      metadata: { ...this.metadata },
      rawUserInput: this.rawUserInput,
      diagnostics: this.diagnostics.slice(),
      shared: Object.fromEntries(this.shared.entries()),
      stageOutputs: Object.fromEntries(this.stageOutputs.entries()),
      timing: {
        ...this.timing,
        stages: this.timing.stages.slice()
      },
      cancelled: this.cancelled,
      cancelReason: this.cancelReason
    };
  }
}

module.exports = PipelineContext;
