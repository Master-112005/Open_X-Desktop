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
    this.blockers = [];
    this.diagnostics = new DecisionDiagnostics();
    this.futureExtensions = {};
  }

  setStatus(status, reason = '', options = {}) {
    const rank = { WAIT: 1, EXECUTE: 2, CONFIRM: 3, CLARIFY: 4, REJECT: 5 };
    if (options.force === true || (rank[status] || 0) >= (rank[this.status] || 0)) this.status = status;
    if (reason) this.reasons.push(reason);
    return this;
  }

  addBlocker(type, details = {}, status = 'CLARIFY') {
    const blocker = {
      type: String(type || 'decision-blocker'),
      ...(details || {})
    };
    this.blockers.push(blocker);
    this.diagnostics.warn(`Decision blocker: ${blocker.type}`, blocker);
    this.setStatus(status, blocker.reason || blocker.type);
    return blocker;
  }

  addClarification(requirement = {}) {
    const key = `${requirement.taskId || ''}:${requirement.field || requirement.type || requirement.reason || ''}`;
    if (!this.clarificationRequirements.some(item => `${item.taskId || ''}:${item.field || item.type || item.reason || ''}` === key)) {
      this.clarificationRequirements.push({ ...(requirement || {}) });
    }
    this.setStatus('CLARIFY', requirement.reason || 'clarification required before execution');
    return this;
  }

  addConfirmation(request = {}) {
    const key = `${request.taskId || ''}:${request.action || ''}:${request.reason || ''}`;
    if (!this.confirmationRequired.some(item => `${item.taskId || ''}:${item.action || ''}:${item.reason || ''}` === key)) {
      this.confirmationRequired.push({ ...(request || {}) });
      this.diagnostics.confirmationRequests.push({ ...(request || {}) });
    }
    this.setStatus('CONFIRM', request.reason || 'confirmation required before execution');
    return this;
  }

  addPolicyResult(result = {}) {
    this.policyResults.push({ ...(result || {}) });
    this.diagnostics.policyDecisions.push({ ...(result || {}) });
    if (result.allowed === false) this.setStatus('REJECT', result.reason || 'policy rejected execution');
    return this;
  }

  addConflict(conflict = {}) {
    this.conflicts.push({ ...(conflict || {}) });
    this.setStatus('CLARIFY', conflict.reason || 'execution conflict requires clarification');
    return this;
  }

  get taskCount() {
    return Array.isArray(this.executionBlueprint?.tasks) ? this.executionBlueprint.tasks.length : 0;
  }

  get actionCounts() {
    const counts = {};
    for (const task of this.executionBlueprint?.tasks || []) {
      const action = String(task.action || 'UNKNOWN');
      counts[action] = (counts[action] || 0) + 1;
    }
    return counts;
  }

  toDecisionResult() {
    this.diagnostics.finish();
    return new DecisionResult({
      status: this.status,
      reasons: this.reasons,
      clarificationRequirements: this.clarificationRequirements,
      confirmationRequired: this.confirmationRequired,
      policyResults: this.policyResults,
      conflicts: this.conflicts,
      blockers: this.blockers,
      metadata: this.metadata,
      diagnostics: this.diagnostics.toJSON(),
      taskCount: this.taskCount,
      actionCounts: this.actionCounts,
      version: this.configuration?.version || '10.0.0',
      futureExtensions: this.futureExtensions
    });
  }
}

module.exports = DecisionContext;
