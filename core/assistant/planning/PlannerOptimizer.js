'use strict';

const BasePlanner = require('./BasePlanner');

class PlannerOptimizer extends BasePlanner {
  plan(context) {
    const before = context.tasks.length;
    const seen = new Set();
    context.tasks = context.tasks.filter(task => {
      if (seen.has(task.id)) return false;
      seen.add(task.id);
      return true;
    });
    context.workflow.tasks = context.workflow.tasks.filter(taskId => seen.has(taskId));
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
