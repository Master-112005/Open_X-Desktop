'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

class VerificationResult {
  constructor(input = {}) {
    this.executionStatus = String(input.executionStatus || 'unknown');
    this.verificationGraph = input.verificationGraph || { nodes: [], edges: [] };
    this.successfulActions = Array.isArray(input.successfulActions) ? input.successfulActions.slice() : [];
    this.failedActions = Array.isArray(input.failedActions) ? input.failedActions.slice() : [];
    this.skippedActions = Array.isArray(input.skippedActions) ? input.skippedActions.slice() : [];
    this.evidence = Array.isArray(input.evidence) ? input.evidence.slice() : [];
    this.diagnostics = input.diagnostics || {};
    this.metadata = { ...(input.metadata || {}) };
    this.timing = { ...(input.timing || {}) };
    this.version = String(input.version || '11.0.0');
    this.futureExtensions = { ...(input.futureExtensions || {}) };
    deepFreeze(this);
  }
}

module.exports = VerificationResult;
