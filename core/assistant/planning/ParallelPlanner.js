'use strict';

const BasePlanner = require('./BasePlanner');

class ParallelPlanner extends BasePlanner {
  plan(context) {
    if (context.configuration?.parallelPlanning === false) return context;
    const independent = context.tasks.filter(task =>
      !context.dependencies.some(dependency => dependency.to === task.id || dependency.from === task.id)
    );
    const parallelTasks = independent.filter(task => context.configuration?.parallelActions?.has?.(task.action));
    const groupedByAction = new Map();
    for (const task of parallelTasks) {
      if (!groupedByAction.has(task.action)) groupedByAction.set(task.action, []);
      groupedByAction.get(task.action).push(task);
    }
    for (const [action, tasks] of groupedByAction.entries()) {
      if (tasks.length <= 1) continue;
      context.parallelGroups.push({
        id: action === 'OPEN_APPLICATION'
          ? 'parallel.openApplications'
          : `parallel.${String(action || 'tasks').toLowerCase().replace(/[^a-z0-9]+/g, '.')}`,
        tasks: tasks.map(task => task.id),
        reason: `independent ${action.toLowerCase().replace(/_/g, ' ')} tasks`
      });
    }
    context.diagnostics.parallelGroups = context.parallelGroups.length;
    return context;
  }
}

module.exports = ParallelPlanner;
