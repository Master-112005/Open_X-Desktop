'use strict';

const BaseValidator = require('./BaseValidator');

class EntityValidator extends BaseValidator {
  validate(context) {
    for (const task of context.executionBlueprint?.tasks || []) {
      const needsTarget = ['OPEN_APPLICATION', 'CLOSE_APPLICATION', 'DELETE_FILE', 'MOVE_FILE', 'OPEN_FOLDER'].includes(task.action);
      if (!needsTarget) continue;
      const hasTarget = Boolean(task.metadata?.entities || task.metadata?.target || context.executionBlueprint?.metadata?.entities);
      context.check(this.id, hasTarget || task.action === 'OPEN_APPLICATION', hasTarget || task.action === 'OPEN_APPLICATION'
        ? 'entity target present or resolvable'
        : 'required entity target missing', { taskId: task.id, action: task.action });
    }
    return context;
  }
}

module.exports = EntityValidator;
