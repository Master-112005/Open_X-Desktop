'use strict';

const BaseResponseGenerator = require('./BaseResponseGenerator');

class ClarificationResponse extends BaseResponseGenerator {
  generate(context) {
    const decision = context.verificationResult?.metadata?.decision || context.verificationResult?.futureExtensions?.decision || null;
    const requirements = decision?.clarificationRequirements || [];
    if (requirements.length === 0) return context;
    context.responseType = 'clarification';
    context.addPart('clarification', `Clarification required: ${requirements.map(item => item.field || item.requirement).join(', ')}.`);
    return context;
  }
}

module.exports = ClarificationResponse;
