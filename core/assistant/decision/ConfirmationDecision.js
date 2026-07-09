'use strict';

const BaseDecision = require('./BaseDecision');

class ConfirmationDecision extends BaseDecision {
  decide(context) {
    const confirmationActions = context.configuration?.confirmationActions || new Set();
    const confirmed = context.metadata.confirmed === true;
    for (const task of context.executionBlueprint?.tasks || []) {
      if (!confirmationActions.has(task.action)) continue;
      if (confirmed) continue;
      const request = {
        taskId: task.id,
        action: task.action,
        reason: 'action requires explicit confirmation'
      };
      context.confirmationRequired.push(request);
      context.diagnostics.confirmationRequests.push(request);
    }
    if (context.confirmationRequired.length > 0) {
      context.setStatus('CONFIRM', 'confirmation required before execution');
    }
    return context;
  }
}

module.exports = ConfirmationDecision;
