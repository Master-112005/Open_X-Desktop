'use strict';

const BaseResponseGenerator = require('./BaseResponseGenerator');
const ResponseStyleManager = require('./ResponseStyleManager');

class ClarificationResponse extends BaseResponseGenerator {
  generate(context) {
    const decision = context.verificationResult?.metadata?.decision || context.verificationResult?.futureExtensions?.decision || null;
    const requirements = Array.isArray(decision?.clarificationRequirements) ? decision.clarificationRequirements : [];
    if (requirements.length === 0) return context;
    context.responseType = 'clarification';
    const fields = requirements
      .map(item => item.field || item.requirement || item.reason)
      .filter(Boolean)
      .slice(0, 4);
    const question = ResponseStyleManager.missingFieldQuestion(fields, context.verificationResult?.intent || '');
    this.addPart(context, 'clarification', fields.length > 0
      ? question
      : 'I need one more detail before I can continue.');
    return context;
  }
}

module.exports = ClarificationResponse;
