'use strict';

const BasePlanner = require('./BasePlanner');
const deepFreeze = require('../utils/ObjectFreeze');

class TaskGraphBuilder extends BasePlanner {
  plan(context) {
    context.taskGraph = deepFreeze({
      nodes: context.tasks.map(task => ({
        id: task.id,
        label: task.label,
        action: task.action,
        optional: task.optional,
        retryable: task.retryable,
        cancelable: task.cancelable,
        confidence: Number(task.metadata?.confidence) || null,
        target: this.actionTarget(task, context)
      })),
      edges: context.dependencies.map(dependency => ({
        from: dependency.from,
        to: dependency.to,
        type: dependency.type
      })),
      parallelGroups: context.parallelGroups.slice(),
      recoveryNodes: context.recoveryPlan.map(plan => ({ taskId: plan.taskId, strategies: plan.strategies.slice() }))
    });
    return context;
  }
}

module.exports = TaskGraphBuilder;
