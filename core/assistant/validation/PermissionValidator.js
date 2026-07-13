'use strict';

const BaseValidator = require('./BaseValidator');

class PermissionValidator extends BaseValidator {
  validate(context) {
    const source = String(context.metadata.source || context.metadata.sourceType || 'chat');
    const permissions = context.configuration?.permissions || {};
    const deniedActions = new Set(context.configuration?.deniedActions || []);
    const allowedActions = context.configuration?.allowedActions
      ? new Set(context.configuration.allowedActions)
      : null;
    const allowed = permissions[source] !== false;
    context.check(this.id, allowed, allowed ? 'source permission allowed' : `source permission denied: ${source}`, { source });
    for (const task of this.tasks(context)) {
      const actionAllowed = !allowedActions || allowedActions.has(task.action);
      const actionDenied = deniedActions.has(task.action);
      context.check(this.id, actionAllowed && !actionDenied, actionAllowed && !actionDenied
        ? 'action permission allowed'
        : 'action permission denied', {
          source,
          taskId: task.id,
          action: task.action
        });
    }
    return context;
  }
}

module.exports = PermissionValidator;
