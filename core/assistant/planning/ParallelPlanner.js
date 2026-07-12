'use strict';

const BasePlanner = require('./BasePlanner');

class ParallelPlanner extends BasePlanner {
  plan(context) {
    if (context.configuration?.parallelPlanning === false) return context;
    const independent = context.tasks.filter(task =>
      !context.dependencies.some(dependency => dependency.to === task.id || dependency.from === task.id)
    );
    const appTasks = independent.filter(task => task.action === 'OPEN_APPLICATION');
    if (appTasks.length > 1) {
      context.parallelGroups.push({
        id: 'parallel.openApplications',
        tasks: appTasks.map(task => task.id),
        reason: 'independent application launches'
      });
    }
    context.diagnostics.parallelGroups = context.parallelGroups.length;
    return context;
  }
}

module.exports = ParallelPlanner;
