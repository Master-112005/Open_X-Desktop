'use strict';

const BaseResponseGenerator = require('./BaseResponseGenerator');

class ConfirmationResponse extends BaseResponseGenerator {
  generate(context) {
    const result = context.verificationResult || {};
    const successfulActions = Array.isArray(result.successfulActions) ? result.successfulActions : [];
    if (result.executionStatus === 'COMPLETED' && successfulActions.length > 0) {
      context.responseType = 'confirmation';
      this.addPart(
        context,
        'confirmation',
        `${successfulActions.length} action${successfulActions.length === 1 ? '' : 's'} completed successfully.`,
        { completed: successfulActions.length }
      );
    }
    return context;
  }
}

module.exports = ConfirmationResponse;
