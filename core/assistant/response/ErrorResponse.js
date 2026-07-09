'use strict';

const BaseResponseGenerator = require('./BaseResponseGenerator');

class ErrorResponse extends BaseResponseGenerator {
  generate(context) {
    const result = context.verificationResult || {};
    if ((result.failedActions || []).length === 0) return context;
    context.responseType = 'error';
    const first = result.failedActions[0];
    context.addPart('error', `Failed: ${first.action || first.route || first.taskId || 'action'}.`);
    return context;
  }
}

module.exports = ErrorResponse;
