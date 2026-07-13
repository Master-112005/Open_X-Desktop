'use strict';

const BaseValidator = require('./BaseValidator');

class EntityValidator extends BaseValidator {
  validate(context) {
    for (const task of this.tasks(context)) {
      const requirement = this._requirementFor(task.action);
      if (!requirement) continue;
      const entities = this.entities(context, task);
      const hasTarget = requirement.some(key => Boolean(entities[key] || task.metadata?.[key] || task.metadata?.target));
      context.check(this.id, hasTarget, hasTarget
        ? 'entity target present or resolvable'
        : 'required entity target missing', {
          taskId: task.id,
          action: task.action,
          requiredAny: requirement
        });
    }
    return context;
  }

  _requirementFor(action) {
    const requirements = {
      OPEN_APPLICATION: ['appName', 'application', 'target'],
      CLOSE_APPLICATION: ['appName', 'application', 'target'],
      SEARCH_WEB: ['query', 'searchQuery', 'target'],
      PLAY_MEDIA: ['mediaQuery', 'query', 'target'],
      OPEN_FOLDER: ['folderPath', 'folderName', 'path', 'target'],
      OPEN_FILE: ['filename', 'filePath', 'path', 'target'],
      DELETE_FILE: ['filename', 'filePath', 'path', 'target'],
      MOVE_FILE: ['filename', 'filePath', 'sourcePath', 'destinationPath', 'path', 'target'],
      CREATE_REMINDER: ['reminderText', 'text', 'title', 'target']
    };
    return requirements[action] || null;
  }
}

module.exports = EntityValidator;
