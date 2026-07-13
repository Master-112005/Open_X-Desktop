'use strict';

const BasePlanner = require('./BasePlanner');

class RecoveryPlanner extends BasePlanner {
  plan(context) {
    if (context.configuration?.recoveryPlanning === false) return context;
    for (const task of context.tasks) {
      const highRisk = task.metadata?.risk === 'high' || task.metadata?.requiresConfirmation === true;
      const mutation = /^(?:DELETE|MOVE|SEND|SYSTEM|FORMAT)/.test(String(task.action || ''));
      context.recoveryPlan.push({
        taskId: task.id,
        strategies: task.optional
          ? ['skip-optional-task']
          : highRisk || mutation
            ? ['abort-workflow']
            : ['retry-once', 'abort-workflow'],
        retryLimit: task.retryable === false || highRisk || mutation ? 0 : 1,
        cancelable: task.cancelable !== false,
        metadataOnly: true
      });
    }
    context.diagnostics.recoveryPlans = context.recoveryPlan.length;
    return context;
  }
}

module.exports = RecoveryPlanner;
