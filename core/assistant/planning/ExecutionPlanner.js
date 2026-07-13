'use strict';

const BasePlanner = require('./BasePlanner');

class ExecutionPlanner extends BasePlanner {
  plan(context) {
    const remaining = new Map(context.tasks.map(task => [task.id, task]));
    const ordered = [];
    while (remaining.size > 0) {
      const next = [...remaining.values()].find(task =>
        context.dependencies
          .filter(dependency => dependency.to === task.id)
          .every(dependency => ordered.includes(dependency.from))
      );
      if (!next) {
        const fallback = remaining.values().next().value;
        context.diagnostics.warn('Dependency cycle or unresolved dependency detected during ordering; using deterministic fallback.', {
          remainingTaskIds: [...remaining.keys()]
        });
        ordered.push(fallback.id);
        remaining.delete(fallback.id);
        continue;
      }
      ordered.push(next.id);
      remaining.delete(next.id);
    }
    context.ordering = ordered.map((taskId, index) => ({
      taskId,
      index,
      mode: context.parallelGroups.some(group => group.tasks.includes(taskId)) ? 'parallel' : 'sequential',
      conditional: false,
      optional: context.tasks.find(task => task.id === taskId)?.optional === true,
      repeatable: context.tasks.find(task => task.id === taskId)?.repeatable === true,
      retryable: context.tasks.find(task => task.id === taskId)?.retryable !== false,
      cancelable: context.tasks.find(task => task.id === taskId)?.cancelable !== false
    }));
    context.conditions = context.tasks.flatMap(task => task.conditions.map(condition => ({ taskId: task.id, condition })));
    context.optionalTasks = context.tasks.filter(task => task.optional).map(task => task.id);
    context.estimatedComplexity = context.tasks.length > 5 ? 'high' : context.tasks.length > 2 ? 'medium' : 'low';
    context.estimatedDuration = context.tasks.reduce((total, task) =>
      total + context.configuration.durationForAction(task.action), 0);
    context.diagnostics.executionOrderCount = context.ordering.length;
    return context;
  }
}

module.exports = ExecutionPlanner;
