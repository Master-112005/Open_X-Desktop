'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

class DecisionResult {
  constructor(input = {}) {
    this.status = String(input.status || 'WAIT');
    this.ready = this.status === 'EXECUTE';
    this.reasons = Array.isArray(input.reasons) ? input.reasons.slice() : [];
    this.clarificationRequirements = Array.isArray(input.clarificationRequirements) ? input.clarificationRequirements.slice() : [];
    this.confirmationRequired = Array.isArray(input.confirmationRequired) ? input.confirmationRequired.slice() : [];
    this.policyResults = Array.isArray(input.policyResults) ? input.policyResults.slice() : [];
    this.conflicts = Array.isArray(input.conflicts) ? input.conflicts.slice() : [];
    this.metadata = { ...(input.metadata || {}) };
    this.diagnostics = input.diagnostics || {};
    this.version = String(input.version || '10.0.0');
    this.futureExtensions = { ...(input.futureExtensions || {}) };
    deepFreeze(this);
  }
}

module.exports = DecisionResult;
