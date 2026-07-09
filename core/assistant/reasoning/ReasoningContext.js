'use strict';

const ReasoningDiagnostics = require('./ReasoningDiagnostics');
const ReasoningResult = require('./ReasoningResult');

function normalize(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

class ReasoningContext {
  constructor({ resolvedContext = null, configuration = null, metadata = {} } = {}) {
    this.resolvedContext = resolvedContext || null;
    this.configuration = configuration || null;
    this.metadata = { ...(metadata || {}) };
    this.input = String(metadata.rawInput || resolvedContext?.metadata?.rawInput || resolvedContext?.metadata?.input || '');
    this.normalizedInput = normalize(this.input);
    this.inferences = [];
    this.candidateGoals = [];
    this.candidateIntents = [];
    this.candidateActions = [];
    this.candidateTasks = [];
    this.missingInformation = [];
    this.clarificationRequirements = [];
    this.detectedConflicts = [];
    this.evidence = [];
    this.confidenceScores = {};
    this.reasoningGraph = { nodes: [], edges: [] };
    this.diagnostics = new ReasoningDiagnostics();
    this.timing = { startedAt: Date.now(), finishedAt: null, durationMs: 0 };
    this.futureExtensions = {};
  }

  has(pattern) {
    return pattern.test(this.normalizedInput);
  }

  addEvidence(type, value, confidence = 0.6, source = '') {
    const evidence = {
      type: String(type || 'evidence'),
      value: String(value || ''),
      confidence: Math.max(0, Math.min(1, Number(confidence) || 0)),
      source: String(source || '')
    };
    this.evidence.push(evidence);
    return evidence;
  }

  addUnique(listName, item) {
    const list = this[listName];
    const key = item.id || item.name || item.action || item.intent || item.task;
    const existing = list.find(candidate => (candidate.id || candidate.name || candidate.action || candidate.intent || candidate.task) === key);
    if (existing) {
      existing.confidence = Math.max(existing.confidence || 0, item.confidence || 0);
      existing.evidence = Array.from(new Set([...(existing.evidence || []), ...(item.evidence || [])]));
      return existing;
    }
    list.push(item);
    return item;
  }

  ranked(listName) {
    return this[listName].slice().sort((left, right) =>
      (Number(right.confidence) || 0) - (Number(left.confidence) || 0) ||
      String(left.id || left.name || left.action || left.intent || left.task).localeCompare(String(right.id || right.name || right.action || right.intent || right.task))
    );
  }

  toReasoningResult() {
    this.timing.finishedAt = this.timing.finishedAt || Date.now();
    this.timing.durationMs = Math.max(0, this.timing.finishedAt - this.timing.startedAt);
    const goals = this.ranked('candidateGoals');
    const intents = this.ranked('candidateIntents');
    const actions = this.ranked('candidateActions');
    return new ReasoningResult({
      resolvedGoal: goals[0] || null,
      candidateGoals: goals,
      resolvedIntent: intents[0] || null,
      candidateIntents: intents,
      resolvedAction: actions[0] || null,
      candidateActions: actions,
      candidateTasks: this.candidateTasks.slice(),
      missingInformation: this.missingInformation.slice(),
      clarificationRequirements: this.clarificationRequirements.slice(),
      detectedConflicts: this.detectedConflicts.slice(),
      reasoningGraph: this.reasoningGraph,
      confidenceScores: this.confidenceScores,
      evidence: this.evidence,
      diagnostics: this.diagnostics.toJSON(),
      metadata: this.metadata,
      timing: this.timing,
      version: this.configuration?.version || '8.0.0',
      futureExtensions: this.futureExtensions
    });
  }
}

module.exports = ReasoningContext;
