'use strict';

const BaseResponseGenerator = require('./BaseResponseGenerator');

class ErrorResponse extends BaseResponseGenerator {
  generate(context) {
    const result = context.verificationResult || {};
    const failedActions = Array.isArray(result.failedActions) ? result.failedActions : [];
    if (failedActions.length === 0) return context;
    context.responseType = 'error';
    const first = failedActions[0];
    const target = first.action || first.route || first.taskId || 'action';
    const reason = first.error || first.reason || first.message || '';
    const targetText = String(target || 'action').replace(/[._-]+/g, ' ').trim() || 'action';
    this.addPart(context, 'error', reason
      ? `I could not complete ${targetText} because ${reason}`
      : `I could not complete ${targetText}.`, { failed: failedActions.length });
    return context;
  }
}

module.exports = ErrorResponse;
