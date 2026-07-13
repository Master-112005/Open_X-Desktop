'use strict';

const BasePlanner = require('./BasePlanner');

class PlannerOptimizer extends BasePlanner {
  plan(context) {
    const before = context.tasks.length;
    const seen = new Set();
    context.tasks = context.tasks.filter(task => {
      if (seen.has(task.id)) {
        context.diagnostics.warn('Removed duplicate task id during optimization.', { taskId: task.id });
        return false;
      }
      seen.add(task.id);
      return true;
    });
    context.removeInvalidReferences();
    context.dependencies = context.dependencies.filter((dependency, index, all) =>
      all.findIndex(item => item.from === dependency.from && item.to === dependency.to && item.type === dependency.type) === index
    );
    context.workflow.tasks = context.workflow.tasks.filter(taskId => seen.has(taskId));
    context.workflow.actionCounts = context.actionCounts();
    context.dependencies = context.dependencies.filter(dependency => seen.has(dependency.from) && seen.has(dependency.to));
    const removed = before - context.tasks.length;
    const result = {
      optimization: 'dedupe-tasks',
      removedTasks: removed,
      strategy: context.configuration?.optimizationLevel || 'safe'
    };
    context.optimizations.push(result);
    context.diagnostics.optimizationResults.push(result);
    return context;
  }
}

module.exports = PlannerOptimizer;
