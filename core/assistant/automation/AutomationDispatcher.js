'use strict';

const AutomationContext = require('./AutomationContext');
const { AutomationExecutionError } = require('./AutomationErrors');

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

class AutomationDispatcher {
  constructor(options = {}) {
    this.configuration = {
      execute: options.execute === true,
      version: String(options.version || '10.0.0'),
      routes: { ...ACTION_ROUTES, ...(options.routes || {}) }
    };
    this.automationEngine = options.automationEngine || null;
  }

  async dispatch(executionBlueprint, decisionResult, validationResult, options = {}) {
    const context = new AutomationContext({
      executionBlueprint,
      decisionResult,
      validationResult,
      automationEngine: options.automationEngine || this.automationEngine,
      configuration: this.configuration,
      metadata: options.metadata || {}
    });

    if (decisionResult?.status !== 'EXECUTE') {
      context.executionStatus = decisionResult?.status || 'WAIT';
      context.skippedActions = (executionBlueprint?.tasks || []).map(task => ({ taskId: task.id, reason: 'decision-not-execute' }));
      return context.toAutomationResult();
    }

    if (!validationResult?.valid) {
      context.executionStatus = 'VALIDATION_FAILED';
      context.skippedActions = (executionBlueprint?.tasks || []).map(task => ({ taskId: task.id, reason: 'validation-failed' }));
      return context.toAutomationResult();
    }

    if (!this.configuration.execute || !context.automationEngine) {
      context.executionStatus = 'NOT_DISPATCHED';
      context.skippedActions = (executionBlueprint?.tasks || []).map(task => ({ taskId: task.id, reason: 'automation-disabled' }));
      return context.toAutomationResult();
    }

    context.executionStatus = 'RUNNING';
    for (const order of executionBlueprint?.ordering || []) {
      const task = (executionBlueprint.tasks || []).find(candidate => candidate.id === order.taskId);
      if (!task?.action) continue;
      const route = task.metadata?.automationAction || this.configuration.routes[task.action];
      if (!route) {
        const failed = { taskId: task.id, action: task.action, success: false, error: 'No automation route' };
        context.failedActions.push(failed);
        context.controllerResults.push(failed);
        continue;
      }
      const started = Date.now();
      try {
        const entities = task.metadata?.entities || executionBlueprint.metadata?.entities || {};
        const result = await context.automationEngine.execute(route, entities, {
          ...(options.executionContext || {}),
          taskId: task.id,
          blueprint: executionBlueprint
        });
        const record = { taskId: task.id, action: task.action, route, success: result?.success === true, result };
        context.controllerResults.push(record);
        context.diagnostics.controller(record);
        if (record.success) context.completedActions.push(record);
        else context.failedActions.push(record);
      } catch (error) {
        const wrapped = new AutomationExecutionError(`Automation failed for task: ${task.id}`, { cause: error });
        context.errors.push({ taskId: task.id, message: wrapped.message });
        context.diagnostics.error(wrapped, { taskId: task.id, route });
        context.failedActions.push({ taskId: task.id, action: task.action, route, success: false, error: error.message });
      } finally {
        context.diagnostics.time(task.id, Date.now() - started);
      }
    }
    context.executionStatus = context.failedActions.length > 0 ? 'PARTIAL_FAILURE' : 'COMPLETED';
    return context.toAutomationResult();
  }
}

AutomationDispatcher.ACTION_ROUTES = ACTION_ROUTES;

module.exports = AutomationDispatcher;
