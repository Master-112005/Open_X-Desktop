'use strict';

const BaseValidator = require('./BaseValidator');

const ACTION_ROUTES = Object.freeze({
  OPEN_APPLICATION: 'app.open',
  CLOSE_APPLICATION: 'app.close',
  SEARCH_WEB: 'browser.search',
  PLAY_MEDIA: 'media.play',
  PAUSE_MEDIA: 'media.pause',
  SET_VOLUME: 'volume.set',
  OPEN_FOLDER: 'folder.open',
  DELETE_FILE: 'file.delete',
  MOVE_FILE: 'file.move',
  CREATE_REMINDER: 'reminder.set'
});

class AutomationValidator extends BaseValidator {
  validate(context) {
    const actions = typeof context.automationEngine?.getActions === 'function'
      ? new Set(context.automationEngine.getActions())
      : null;
    for (const task of context.executionBlueprint?.tasks || []) {
      if (!task.action) continue;
      const route = ACTION_ROUTES[task.action] || task.metadata?.automationAction || null;
      const routeKnown = Boolean(route);
      const controllerAvailable = !actions || (route && actions.has(route));
      context.check(this.id, routeKnown && controllerAvailable, routeKnown && controllerAvailable
        ? 'automation route available'
        : 'automation route unavailable', { taskId: task.id, action: task.action, route });
    }
    return context;
  }
}

AutomationValidator.ACTION_ROUTES = ACTION_ROUTES;

module.exports = AutomationValidator;
