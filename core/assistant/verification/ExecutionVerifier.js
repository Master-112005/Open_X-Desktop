'use strict';

const BaseVerifier = require('./BaseVerifier');

class ExecutionVerifier extends BaseVerifier {
  verify(context) {
    const result = context.automationResult || {};
    context.successfulActions = (result.completedActions || []).slice();
    context.failedActions = (result.failedActions || []).slice();
    context.skippedActions = (result.skippedActions || []).slice();
    context.executionStatus = result.executionStatus || 'unknown';
    context.addEvidence('execution-status', context.executionStatus, {
      completed: context.successfulActions.length,
      failed: context.failedActions.length,
      skipped: context.skippedActions.length
    });
    return context;
  }
}

module.exports = ExecutionVerifier;
