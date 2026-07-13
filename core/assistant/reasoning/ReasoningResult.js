'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

class ReasoningResult {
  constructor(input = {}) {
    this.resolvedGoal = input.resolvedGoal || null;
    this.candidateGoals = Array.isArray(input.candidateGoals) ? input.candidateGoals.slice() : [];
    this.resolvedIntent = input.resolvedIntent || null;
    this.candidateIntents = Array.isArray(input.candidateIntents) ? input.candidateIntents.slice() : [];
    this.resolvedAction = input.resolvedAction || null;
    this.candidateActions = Array.isArray(input.candidateActions) ? input.candidateActions.slice() : [];
    this.candidateTasks = Array.isArray(input.candidateTasks) ? input.candidateTasks.slice() : [];
    this.missingInformation = Array.isArray(input.missingInformation) ? input.missingInformation.slice() : [];
    this.clarificationRequirements = Array.isArray(input.clarificationRequirements) ? input.clarificationRequirements.slice() : [];
    this.detectedConflicts = Array.isArray(input.detectedConflicts) ? input.detectedConflicts.slice() : [];
    this.reasoningGraph = input.reasoningGraph || { nodes: [], edges: [] };
    this.confidenceScores = { ...(input.confidenceScores || {}) };
    this.evidence = Array.isArray(input.evidence) ? input.evidence.slice() : [];
    this.diagnostics = input.diagnostics || {};
    this.metadata = { ...(input.metadata || {}) };
    this.entitySummary = { ...(input.entitySummary || {}) };
    this.ready = Boolean(this.resolvedGoal && this.resolvedIntent && this.resolvedAction && this.clarificationRequirements.length === 0);
    this.timing = { ...(input.timing || {}) };
    this.version = String(input.version || '8.0.0');
    this.futureExtensions = { ...(input.futureExtensions || {}) };
    deepFreeze(this);
  }
}

module.exports = ReasoningResult;
