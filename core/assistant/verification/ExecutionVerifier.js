'use strict';

const BaseVerifier = require('./BaseVerifier');

class ExecutionVerifier extends BaseVerifier {
  verify(context) {
    const result = context.automationResult || {};
    context.successfulActions = (result.completedActions || []).slice();
    context.failedActions = (result.failedActions || []).slice();
    context.skippedActions = (result.skippedActions || []).slice();
    context.executionStatus = result.executionStatus || 'unknown';
    const status = context.failedActions.length > 0
      ? 'failed'
      : context.executionStatus === 'COMPLETED'
        ? 'verified'
        : context.skippedActions.length > 0
          ? 'skipped'
          : 'unknown';
    context.addEvidence('execution-status', context.executionStatus, {
      completed: context.successfulActions.length,
      failed: context.failedActions.length,
      skipped: context.skippedActions.length,
      controllerResults: Array.isArray(result.controllerResults) ? result.controllerResults.length : 0
    }, {
      status,
      confidence: status === 'verified' ? 0.92 : status === 'failed' ? 0.18 : 0.55,
      source: this.id
    });
    for (const action of context.successfulActions) {
      context.addEvidence('action-completed', action.action || action.route || action.taskId, {
        taskId: action.taskId,
        route: action.route
      }, { status: 'verified', confidence: 0.88, source: this.id });
    }
    for (const action of context.failedActions) {
      context.addEvidence('action-failed', action.action || action.route || action.taskId, {
        taskId: action.taskId,
        route: action.route,
        error: action.error || null
      }, { status: 'failed', confidence: 0.2, source: this.id });
    }
    return context;
  }
}

module.exports = ExecutionVerifier;
