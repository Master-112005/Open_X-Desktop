'use strict';

const BaseResponseGenerator = require('./BaseResponseGenerator');

class SuggestionResponse extends BaseResponseGenerator {
  generate(context) {
    if (context.configuration?.suggestions === false) return context;
    const failed = context.verificationResult?.failedActions || [];
    if (failed.length > 0) {
      context.addSuggestion('recovery', 'Review the failed action evidence before retrying.', { failed: failed.length });
    } else if (context.responseType === 'clarification') {
      context.addSuggestion('clarification', 'Provide the missing detail and I can continue.');
    }
    return context;
  }
}

module.exports = SuggestionResponse;
