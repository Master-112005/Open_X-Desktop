'use strict';

const DEFAULT_REASONER_OPTIONS = Object.freeze({
  enabled: true,
  priority: 100,
  confidenceThreshold: 0.45,
  strategy: 'deterministic'
});

class ReasoningConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || '8.0.0');
    this.strict = input.strict === true;
    this.confidenceThreshold = Math.max(0, Math.min(1, Number(input.confidenceThreshold ?? 0.45)));
    this.strategy = String(input.strategy || 'deterministic');
    this.maxCandidates = Number.isFinite(input.maxCandidates) ? Math.max(1, Number(input.maxCandidates)) : 25;
    this.maxEvidence = Number.isFinite(input.maxEvidence) ? Math.max(25, Number(input.maxEvidence)) : 160;
    this.graphMaxNodes = Number.isFinite(input.graphMaxNodes) ? Math.max(40, Number(input.graphMaxNodes)) : 220;
    this.graphMaxEdges = Number.isFinite(input.graphMaxEdges) ? Math.max(60, Number(input.graphMaxEdges)) : 360;
    this.reasonerWarningMs = Number.isFinite(input.reasonerWarningMs) ? Math.max(1, Number(input.reasonerWarningMs)) : 75;
    this.contextBoost = Math.max(0, Math.min(0.25, Number(input.contextBoost ?? 0.08)));
    this.entityBoost = Math.max(0, Math.min(0.25, Number(input.entityBoost ?? 0.1)));
    this.cognitiveSignalBoost = Math.max(0, Math.min(0.25, Number(input.cognitiveSignalBoost ?? 0.05)));
    this.deliberationBoost = Math.max(0, Math.min(0.25, Number(input.deliberationBoost ?? 0.08)));
    this.ambiguityPenalty = Math.max(0, Math.min(0.25, Number(input.ambiguityPenalty ?? 0.08)));
    this.reasoners = { ...(input.reasoners || {}) };
    this.providers = { ...(input.providers || {}) };
  }

  getReasonerOptions(id, defaults = {}) {
    return {
      ...DEFAULT_REASONER_OPTIONS,
      ...(defaults || {}),
      ...(this.reasoners[String(id || '')] || {})
    };
  }

  toJSON() {
    return {
      enabled: this.enabled,
      version: this.version,
      strict: this.strict,
      confidenceThreshold: this.confidenceThreshold,
      strategy: this.strategy,
      maxCandidates: this.maxCandidates,
      maxEvidence: this.maxEvidence,
      graphMaxNodes: this.graphMaxNodes,
      graphMaxEdges: this.graphMaxEdges,
      reasonerWarningMs: this.reasonerWarningMs,
      contextBoost: this.contextBoost,
      entityBoost: this.entityBoost,
      cognitiveSignalBoost: this.cognitiveSignalBoost,
      deliberationBoost: this.deliberationBoost,
      ambiguityPenalty: this.ambiguityPenalty,
      reasoners: { ...this.reasoners }
    };
  }
}

module.exports = ReasoningConfiguration;
