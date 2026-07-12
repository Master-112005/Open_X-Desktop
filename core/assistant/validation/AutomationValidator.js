'use strict';

const BaseValidator = require('./BaseValidator');
const AutomationDispatcher = require('../automation/AutomationDispatcher');

class AutomationValidator extends BaseValidator {
  validate(context) {
    const actions = typeof context.automationEngine?.getActions === 'function'
      ? new Set(context.automationEngine.getActions())
      : null;
    const routes = context.metadata?.automationRoutes || AutomationDispatcher.ACTION_ROUTES;
    for (const task of context.executionBlueprint?.tasks || []) {
      if (!task.action) continue;
      const route = AutomationDispatcher.resolveAutomationRoute(task, routes);
      const routeKnown = Boolean(route);
      const controllerAvailable = !actions || (route && actions.has(route));
      context.check(this.id, routeKnown && controllerAvailable, routeKnown && controllerAvailable
        ? 'automation route available'
        : 'automation route unavailable', { taskId: task.id, action: task.action, route });
    }
    return context;
  }
}

AutomationValidator.ACTION_ROUTES = AutomationDispatcher.ACTION_ROUTES;

module.exports = AutomationValidator;
