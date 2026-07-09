'use strict';

const BaseResponseGenerator = require('./BaseResponseGenerator');

class ConfirmationResponse extends BaseResponseGenerator {
  generate(context) {
    const result = context.verificationResult || {};
    if (result.executionStatus === 'COMPLETED' && result.successfulActions.length > 0) {
      context.responseType = 'confirmation';
      context.addPart('confirmation', `${result.successfulActions.length} action${result.successfulActions.length === 1 ? '' : 's'} completed successfully.`);
    }
    return context;
  }
}

module.exports = ConfirmationResponse;
