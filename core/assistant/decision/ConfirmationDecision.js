'use strict';

const BaseDecision = require('./BaseDecision');

class ConfirmationDecision extends BaseDecision {
  decide(context) {
    const confirmationActions = context.configuration?.confirmationActions || new Set();
    const confirmed = context.metadata.confirmed === true;
    for (const task of this.tasks(context)) {
      const requiresConfirmation = confirmationActions.has(task.action) ||
        task.metadata?.requiresConfirmation === true ||
        task.metadata?.dangerous === true ||
        task.metadata?.risk === 'high';
      if (!requiresConfirmation) continue;
      if (confirmed) continue;
      const request = {
        taskId: task.id,
        action: task.action,
        target: this.actionTarget(task, context),
        reason: task.metadata?.confirmationReason || 'action requires explicit confirmation'
      };
      context.addConfirmation(request);
    }
    return context;
  }
}

module.exports = ConfirmationDecision;
