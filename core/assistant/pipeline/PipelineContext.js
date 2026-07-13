'use strict';

const IdGenerator = require('../utils/IdGenerator');
const deepFreeze = require('../utils/ObjectFreeze');

const idGenerator = new IdGenerator({ prefix: 'pipe' });
const DEFAULT_LIMITS = Object.freeze({
  diagnostics: 500,
  stageTimings: 100,
  sharedEntries: 200
});

function pushBounded(list, value, limit) {
  list.push(value);
  if (list.length > limit) list.splice(0, list.length - limit);
  return list;
}

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
    this.limits = {
      diagnostics: Math.max(25, Number(this.options.pipelineMaxDiagnostics || this.metadata.pipelineMaxDiagnostics) || DEFAULT_LIMITS.diagnostics),
      stageTimings: Math.max(10, Number(this.options.pipelineMaxStageTimings || this.metadata.pipelineMaxStageTimings) || DEFAULT_LIMITS.stageTimings),
      sharedEntries: Math.max(10, Number(this.options.pipelineMaxSharedEntries || this.metadata.pipelineMaxSharedEntries) || DEFAULT_LIMITS.sharedEntries)
    };
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
    const normalizedKey = String(key);
    if (this.shared.size >= this.limits.sharedEntries && !this.shared.has(normalizedKey)) {
      const removableKey = [...this.shared.keys()].find(item => !String(item).startsWith('assistant.'))
        || this.shared.keys().next().value;
      this.shared.delete(removableKey);
    }
    this.shared.set(normalizedKey, value);
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

  getStageOutput(stageId, fallback = undefined) {
    const id = String(stageId || '');
    return this.stageOutputs.has(id) ? this.stageOutputs.get(id) : fallback;
  }

  addDiagnostic(record = {}) {
    pushBounded(this.diagnostics, {
      level: String(record.level || 'info'),
      message: String(record.message || ''),
      code: String(record.code || ''),
      data: { ...(record.data || {}) },
      timestamp: Number(record.timestamp) || Date.now()
    }, this.limits.diagnostics);
    return this;
  }

  addStageTiming(stageId, durationMs, success = true, metadata = {}) {
    pushBounded(this.timing.stages, {
      stageId: String(stageId || ''),
      durationMs: Math.max(0, Number(durationMs) || 0),
      success: success === true,
      metadata: { ...(metadata || {}) }
    }, this.limits.stageTimings);
    return this;
  }

  getCommandInput() {
    const intentText = this.get('assistant.commandIntentText', '');
    return String(intentText || this.normalizedInput || this.rawInput || '').trim();
  }

  setMetadata(key, value) {
    this.metadata[String(key || '')] = value;
    return this;
  }

  completeTiming(durationMs) {
    this.timing.finishedAt = Date.now();
    this.timing.durationMs = Math.max(0, Number(durationMs) || (this.timing.finishedAt - this.timing.startedAt));
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
        commandIntentText: this.normalizedInputObject.commandIntentText || this.normalizedInputObject.metadata?.commandIntentText || '',
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
