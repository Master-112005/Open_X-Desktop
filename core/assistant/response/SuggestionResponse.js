'use strict';

const BaseResponseGenerator = require('./BaseResponseGenerator');

class SuggestionResponse extends BaseResponseGenerator {
  generate(context) {
    if (context.configuration?.suggestions === false) return context;
    const failed = context.verificationResult?.failedActions || [];
    if (failed.length > 0) {
      context.suggestions.push({ type: 'recovery', text: 'Review the failed action evidence before retrying.' });
    }
    return context;
  }
}

module.exports = SuggestionResponse;
