'use strict';

const VerificationDiagnostics = require('./VerificationDiagnostics');
const VerificationResult = require('./VerificationResult');

class VerificationContext {
  constructor({ automationResult = null, configuration = null, metadata = {} } = {}) {
    this.automationResult = automationResult || null;
    this.configuration = configuration || null;
    this.metadata = { ...(metadata || {}) };
    this.executionStatus = automationResult?.executionStatus || 'unknown';
    this.successfulActions = [];
    this.failedActions = [];
    this.skippedActions = [];
    this.evidence = [];
    this.verificationGraph = { nodes: [], edges: [] };
    this.diagnostics = new VerificationDiagnostics();
    this.timing = { startedAt: Date.now(), finishedAt: null, durationMs: 0 };
    this.futureExtensions = {};
  }

  addEvidence(type, value, data = {}) {
    const evidence = { type: String(type || 'evidence'), value: String(value || ''), data: { ...(data || {}) } };
    this.evidence.push(evidence);
    this.diagnostics.evidence(evidence);
    return evidence;
  }

  toVerificationResult() {
    this.timing.finishedAt = this.timing.finishedAt || Date.now();
    this.timing.durationMs = Math.max(0, this.timing.finishedAt - this.timing.startedAt);
    return new VerificationResult({
      executionStatus: this.executionStatus,
      verificationGraph: this.verificationGraph,
      successfulActions: this.successfulActions,
      failedActions: this.failedActions,
      skippedActions: this.skippedActions,
      evidence: this.evidence,
      diagnostics: this.diagnostics.toJSON(),
      metadata: this.metadata,
      timing: this.timing,
      version: this.configuration?.version || '11.0.0',
      futureExtensions: this.futureExtensions
    });
  }
}

module.exports = VerificationContext;
