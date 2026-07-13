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

  addEvidence(type, value, data = {}, options = {}) {
    const confidence = Math.max(0, Math.min(1, Number(options.confidence ?? 0.7)));
    const status = String(options.status || (confidence >= (this.configuration?.minVerifiedConfidence || 0.6) ? 'verified' : 'unknown'));
    const evidence = {
      type: String(type || 'evidence'),
      value: String(value || ''),
      status,
      confidence,
      source: String(options.source || ''),
      data: { ...(data || {}) }
    };
    this.evidence.push(evidence);
    if (this.configuration?.maxEvidence && this.evidence.length > this.configuration.maxEvidence) {
      this.evidence.splice(0, this.evidence.length - this.configuration.maxEvidence);
    }
    this.diagnostics.evidence(evidence);
    return evidence;
  }

  warn(message, data = {}) {
    this.diagnostics.warn(message, data);
  }

  error(error, data = {}) {
    this.diagnostics.error(error, data);
  }

  summary() {
    const verifiedEvidence = this.evidence.filter(item => item.status === 'verified').length;
    const failedEvidence = this.evidence.filter(item => item.status === 'failed').length;
    const confidence = this.evidence.length === 0
      ? 0
      : this.evidence.reduce((sum, item) => sum + item.confidence, 0) / this.evidence.length;
    const verified = this.failedActions.length === 0 &&
      failedEvidence === 0 &&
      (this.executionStatus === 'COMPLETED' || verifiedEvidence > 0);
    return {
      verified,
      confidence: Math.round(confidence * 1000) / 1000,
      evidenceCount: this.evidence.length,
      verifiedEvidence,
      failedEvidence,
      completed: this.successfulActions.length,
      failed: this.failedActions.length,
      skipped: this.skippedActions.length
    };
  }

  toVerificationResult() {
    this.timing.finishedAt = this.timing.finishedAt || Date.now();
    this.timing.durationMs = Math.max(0, this.timing.finishedAt - this.timing.startedAt);
    return new VerificationResult({
      verified: this.summary().verified,
      confidence: this.summary().confidence,
      executionStatus: this.executionStatus,
      verificationGraph: this.verificationGraph,
      successfulActions: this.successfulActions,
      failedActions: this.failedActions,
      skippedActions: this.skippedActions,
      evidence: this.evidence,
      summary: this.summary(),
      diagnostics: this.diagnostics.toJSON(),
      metadata: this.metadata,
      timing: this.timing,
      version: this.configuration?.version || '11.0.0',
      futureExtensions: this.futureExtensions
    });
  }
}

module.exports = VerificationContext;
