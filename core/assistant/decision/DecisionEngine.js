'use strict';

const BaseDecision = require('./BaseDecision');

class DecisionEngine extends BaseDecision {
  decide(context) {
    const blueprint = context.executionBlueprint || {};
    if (!Array.isArray(blueprint.tasks) || blueprint.tasks.length === 0) {
      context.setStatus('WAIT', 'execution blueprint has no tasks');
      return context;
    }
    if (blueprint.tasks.length > context.configuration.maxTasks) {
      context.addBlocker('too-many-tasks', {
        taskCount: blueprint.tasks.length,
        maxTasks: context.configuration.maxTasks,
        reason: 'execution blueprint has too many tasks'
      }, 'REJECT');
      return context;
    }
    const seen = new Set();
    for (const task of blueprint.tasks) {
      if (!task?.id || !task?.action) {
        context.addBlocker('invalid-task', {
          taskId: task?.id || '',
          action: task?.action || '',
          reason: 'execution blueprint contains a task without id or action'
        }, 'REJECT');
        return context;
      }
      if (seen.has(task.id)) {
        context.addBlocker('duplicate-task-id', {
          taskId: task.id,
          reason: 'execution blueprint contains duplicate task ids'
        }, 'REJECT');
        return context;
      }
      seen.add(task.id);
    }
    context.setStatus('EXECUTE', 'execution blueprint contains tasks');
    return context;
  }
}

module.exports = DecisionEngine;
