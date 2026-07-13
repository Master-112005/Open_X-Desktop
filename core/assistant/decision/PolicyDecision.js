'use strict';

const BaseDecision = require('./BaseDecision');

class PolicyDecision extends BaseDecision {
  decide(context) {
    const disabled = context.configuration?.disabledActions || new Set();
    const allowed = context.configuration?.allowedActions || null;
    for (const task of this.tasks(context)) {
      const explicitlyDisabled = disabled.has('*') || disabled.has(task.action);
      const notAllowed = allowed && !allowed.has(task.action);
      const metadataBlocked = task.metadata?.disabled === true || task.metadata?.policy?.allowed === false;
      if (!explicitlyDisabled && !notAllowed && !metadataBlocked) continue;
      const result = {
        taskId: task.id,
        action: task.action,
        target: this.actionTarget(task, context),
        policy: notAllowed ? 'action-not-allowed' : metadataBlocked ? 'metadata-policy' : 'disabled-action',
        allowed: false,
        reason: task.metadata?.policy?.reason || 'policy rejected execution'
      };
      context.addPolicyResult(result);
    }
    return context;
  }
}

module.exports = PolicyDecision;
