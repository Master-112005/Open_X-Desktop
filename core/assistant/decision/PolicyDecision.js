'use strict';

const BaseDecision = require('./BaseDecision');

class PolicyDecision extends BaseDecision {
  decide(context) {
    const disabled = context.configuration?.disabledActions || new Set();
    for (const task of context.executionBlueprint?.tasks || []) {
      if (!disabled.has(task.action)) continue;
      const result = {
        taskId: task.id,
        action: task.action,
        policy: 'disabled-action',
        allowed: false
      };
      context.policyResults.push(result);
      context.diagnostics.policyDecisions.push(result);
    }
    if (context.policyResults.some(result => result.allowed === false)) {
      context.setStatus('REJECT', 'policy rejected execution');
    }
    return context;
  }
}

module.exports = PolicyDecision;
