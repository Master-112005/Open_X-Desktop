'use strict';

const BasePlanner = require('./BasePlanner');

class RecoveryPlanner extends BasePlanner {
  plan(context) {
    if (context.configuration?.recoveryPlanning === false) return context;
    for (const task of context.tasks) {
      context.recoveryPlan.push({
        taskId: task.id,
        strategies: task.optional
          ? ['skip-optional-task']
          : ['retry-once', 'abort-workflow'],
        metadataOnly: true
      });
    }
    context.diagnostics.recoveryPlans = context.recoveryPlan.length;
    return context;
  }
}

module.exports = RecoveryPlanner;
