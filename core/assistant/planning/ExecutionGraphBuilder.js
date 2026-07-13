'use strict';

const BasePlanner = require('./BasePlanner');
const deepFreeze = require('../utils/ObjectFreeze');

class ExecutionGraphBuilder extends BasePlanner {
  plan(context) {
    context.executionGraph = deepFreeze({
      nodes: context.ordering.map(order => ({
        id: order.taskId,
        index: order.index,
        mode: order.mode,
        optional: order.optional,
        retryable: order.retryable,
        cancelable: order.cancelable,
        action: context.tasks.find(task => task.id === order.taskId)?.action || null
      })),
      edges: [
        ...context.dependencies.map(dependency => ({
          from: dependency.from,
          to: dependency.to,
          type: dependency.type || 'requires'
        })),
        ...context.ordering.slice(1).map((order, index) => ({
          from: context.ordering[index].taskId,
          to: order.taskId,
          type: order.mode === 'parallel' ? 'parallel-branch' : 'next'
        }))
      ].filter((edge, index, all) =>
        all.findIndex(item => item.from === edge.from && item.to === edge.to && item.type === edge.type) === index
      ),
      conditionalBranches: context.conditions.slice(),
      recoveryPaths: context.recoveryPlan.slice(),
      retryPaths: context.recoveryPlan
        .filter(plan => plan.strategies.includes('retry-once'))
        .map(plan => ({ taskId: plan.taskId, strategy: 'retry-once' })),
      cancellationPoints: context.tasks.filter(task => task.cancelable).map(task => task.id)
    });
    return context;
  }
}

module.exports = ExecutionGraphBuilder;
