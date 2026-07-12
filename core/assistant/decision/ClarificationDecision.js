'use strict';

const BaseDecision = require('./BaseDecision');

class ClarificationDecision extends BaseDecision {
  decide(context) {
    const requirements = context.executionBlueprint?.metadata?.clarificationRequirements || [];
    if (Array.isArray(requirements) && requirements.length > 0) {
      context.clarificationRequirements.push(...requirements);
      context.setStatus('CLARIFY', 'clarification required before execution');
    }
    return context;
  }
}

module.exports = ClarificationDecision;
