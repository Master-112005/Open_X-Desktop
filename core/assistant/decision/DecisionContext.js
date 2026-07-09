'use strict';

const DecisionDiagnostics = require('./DecisionDiagnostics');
const DecisionResult = require('./DecisionResult');

class DecisionContext {
  constructor({ executionBlueprint = null, configuration = null, metadata = {} } = {}) {
    this.executionBlueprint = executionBlueprint || null;
    this.configuration = configuration || null;
    this.metadata = { ...(metadata || {}) };
    this.status = 'WAIT';
    this.reasons = [];
    this.clarificationRequirements = [];
    this.confirmationRequired = [];
    this.policyResults = [];
    this.conflicts = [];
    this.diagnostics = new DecisionDiagnostics();
    this.futureExtensions = {};
  }

  setStatus(status, reason = '') {
    const rank = { WAIT: 1, EXECUTE: 2, CONFIRM: 3, CLARIFY: 4, REJECT: 5 };
    if ((rank[status] || 0) >= (rank[this.status] || 0)) this.status = status;
    if (reason) this.reasons.push(reason);
  }

  toDecisionResult() {
    return new DecisionResult({
      status: this.status,
      reasons: this.reasons,
      clarificationRequirements: this.clarificationRequirements,
      confirmationRequired: this.confirmationRequired,
      policyResults: this.policyResults,
      conflicts: this.conflicts,
      metadata: this.metadata,
      diagnostics: this.diagnostics.toJSON(),
      version: this.configuration?.version || '10.0.0',
      futureExtensions: this.futureExtensions
    });
  }
}

module.exports = DecisionContext;
