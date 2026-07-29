'use strict';

const BaseResponseGenerator = require('./BaseResponseGenerator');

class SuggestionResponse extends BaseResponseGenerator {
  generate(context) {
    if (context.configuration?.suggestions === false) return context;
    const failed = context.verificationResult?.failedActions || [];
    const policy = context.futureExtensions.responsePolicy || {};
    const recovery = policy.recovery?.suggestion;

    if (failed.length > 0) {
      context.addSuggestion('recovery', recovery || 'Check the target and try again.', { failed: failed.length });
    } else if (context.responseType === 'clarification' || policy.responseKind === 'clarification') {
      context.addSuggestion('clarification', 'Reply with the missing detail and I can continue.');
    } else if (policy.responseKind === 'confirmation') {
      context.addSuggestion('decision', 'Confirm to continue, or cancel to stop the action.');
    } else {
      const nextActions = context.resultData?.().suggestedNextActions || context.verificationResult?.suggestedNextActions || [];
      (Array.isArray(nextActions) ? nextActions : [])
        .slice(0, Number(context.configuration?.maxSuggestions || 8))
        .forEach(action => {
          const text = action?.text || action?.label || action;
          if (text) context.addSuggestion('nextAction', text, action);
        });
    }
    return context;
  }
}

module.exports = SuggestionResponse;
