'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

const DECISION_STATUSES = Object.freeze({
  WAIT: 'WAIT',
  EXECUTE: 'EXECUTE',
  CONFIRM: 'CONFIRM',
  CLARIFY: 'CLARIFY',
  REJECT: 'REJECT'
});

class DecisionResult {
  constructor(input = {}) {
    this.status = String(input.status || 'WAIT');
    this.ready = this.status === 'EXECUTE';
    this.reasons = Array.isArray(input.reasons) ? input.reasons.slice() : [];
    this.clarificationRequirements = Array.isArray(input.clarificationRequirements) ? input.clarificationRequirements.slice() : [];
    this.confirmationRequired = Array.isArray(input.confirmationRequired) ? input.confirmationRequired.slice() : [];
    this.policyResults = Array.isArray(input.policyResults) ? input.policyResults.slice() : [];
    this.conflicts = Array.isArray(input.conflicts) ? input.conflicts.slice() : [];
    this.blockers = Array.isArray(input.blockers) ? input.blockers.slice() : [];
    this.metadata = { ...(input.metadata || {}) };
    this.diagnostics = input.diagnostics || {};
    this.taskCount = Math.max(0, Number(input.taskCount) || 0);
    this.actionCounts = { ...(input.actionCounts || {}) };
    this.blocked = this.status !== 'EXECUTE';
    this.version = String(input.version || '10.0.0');
    this.futureExtensions = { ...(input.futureExtensions || {}) };
    deepFreeze(this);
  }
}

DecisionResult.STATUSES = DECISION_STATUSES;

module.exports = DecisionResult;
module.exports.DECISION_STATUSES = DECISION_STATUSES;
