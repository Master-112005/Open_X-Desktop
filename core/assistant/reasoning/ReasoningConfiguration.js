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
    this.contextBoost = Math.max(0, Math.min(0.25, Number(input.contextBoost ?? 0.08)));
    this.entityBoost = Math.max(0, Math.min(0.25, Number(input.entityBoost ?? 0.1)));
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
      contextBoost: this.contextBoost,
      entityBoost: this.entityBoost,
      reasoners: { ...this.reasoners }
    };
  }
}

module.exports = ReasoningConfiguration;
