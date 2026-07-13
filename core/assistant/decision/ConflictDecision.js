'use strict';

const BaseDecision = require('./BaseDecision');

class ConflictDecision extends BaseDecision {
  decide(context) {
    const tasks = this.tasks(context);
    const conflictRules = [
      ...(context.configuration?.conflictRules || []),
      { actions: ['OPEN_APPLICATION', 'CLOSE_APPLICATION'], targetAware: true },
      { actions: ['SET_VOLUME', 'MUTE_AUDIO'], targetAware: false },
      { actions: ['SHUTDOWN_SYSTEM', 'SYSTEM_RESTART'], targetAware: false },
      { actions: ['SYSTEM_SHUTDOWN', 'SYSTEM_RESTART'], targetAware: false }
    ];

    for (const rule of conflictRules) {
      const [left, right] = Array.isArray(rule) ? rule : rule.actions || [];
      if (!left || !right) continue;
      const leftTasks = tasks.filter(task => task.action === left);
      const rightTasks = tasks.filter(task => task.action === right);
      if (leftTasks.length === 0 || rightTasks.length === 0) continue;

      for (const leftTask of leftTasks) {
        for (const rightTask of rightTasks) {
          const leftTarget = this.actionTarget(leftTask, context);
          const rightTarget = this.actionTarget(rightTask, context);
          const sameTarget = leftTarget && rightTarget && leftTarget === rightTarget;
          const unknownTarget = !leftTarget || !rightTarget;
          if (rule.targetAware === true && !sameTarget && !unknownTarget) continue;
          context.addConflict({
            type: 'action-conflict',
            actions: [left, right],
            taskIds: [leftTask.id, rightTask.id],
            target: sameTarget ? leftTarget : '',
            reason: 'execution conflict requires clarification'
          });
        }
      }
    }
    return context;
  }
}

module.exports = ConflictDecision;
