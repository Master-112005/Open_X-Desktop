'use strict';

const { deepFreeze } = require('../shared/UtilsCore');
const { isCancellationError, throwIfAborted } = require('../shared/UtilsCore');
const PipelineStage = require('../pipeline/PipelineStage');
const StageResult = require('../pipeline/StageResult');

class AutomationDispatchError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = details.context || null;
    this.diagnostics = details.diagnostics || [];
    this.code = details.code || this.constructor.name;
    if (details.cause) this.cause = details.cause;
  }
}

class AutomationExecutionError extends AutomationDispatchError {}
class ConfigurationError extends AutomationDispatchError {}
class PipelineError extends AutomationDispatchError {}

const MAX_DIAGNOSTIC_ITEMS = 100;

function pushBounded(list, item) {
  list.push(item);
  if (list.length > MAX_DIAGNOSTIC_ITEMS) list.splice(0, list.length - MAX_DIAGNOSTIC_ITEMS);
}

class AutomationDiagnostics {
  constructor() {
    this.automationTime = {};
    this.controllerExecution = [];
    this.warnings = [];
    this.errors = [];
    this.executionGraph = null;
    this.pipelineOrder = [];
    this.memoryUsage = this._memoryUsage();
  }

  time(id, durationMs) {
    this.automationTime[String(id || '')] = Math.max(0, Number(durationMs) || 0);
  }

  controller(record = {}) {
    pushBounded(this.controllerExecution, { ...record, timestamp: Date.now() });
  }

  warn(message, data = {}) {
    pushBounded(this.warnings, { message: String(message || ''), data, timestamp: Date.now() });
  }

  error(error, data = {}) {
    pushBounded(this.errors, {
      name: error?.name || 'Error',
      message: String(error?.message || error || ''),
      stack: error?.stack || '',
      data,
      timestamp: Date.now()
    });
  }

  _memoryUsage() {
    return typeof process !== 'undefined' && typeof process.memoryUsage === 'function'
      ? process.memoryUsage()
      : null;
  }

  toJSON() {
    return {
      automationTime: { ...this.automationTime },
      controllerExecution: this.controllerExecution.slice(),
      warnings: this.warnings.slice(),
      errors: this.errors.slice(),
      executionGraph: this.executionGraph,
      pipelineOrder: this.pipelineOrder.slice(),
      memoryUsage: this.memoryUsage
    };
  }
}

class AutomationResult {
  constructor(input = {}) {
    this.decision = input.decision || null;
    this.validation = input.validation || null;
    this.executionStatus = String(input.executionStatus || 'NOT_DISPATCHED');
    this.completedActions = Array.isArray(input.completedActions) ? input.completedActions.slice() : [];
    this.failedActions = Array.isArray(input.failedActions) ? input.failedActions.slice() : [];
    this.skippedActions = Array.isArray(input.skippedActions) ? input.skippedActions.slice() : [];
    this.controllerResults = Array.isArray(input.controllerResults) ? input.controllerResults.slice() : [];
    this.executionGraph = input.executionGraph || { nodes: [], edges: [] };
    this.timing = { ...(input.timing || {}) };
    this.diagnostics = input.diagnostics || {};
    this.errors = Array.isArray(input.errors) ? input.errors.slice() : [];
    this.warnings = Array.isArray(input.warnings) ? input.warnings.slice() : [];
    this.metadata = { ...(input.metadata || {}) };
    this.version = String(input.version || '10.0.0');
    this.futureExtensions = { ...(input.futureExtensions || {}) };
    deepFreeze(this);
  }
}

class AutomationExecutionGraph {
  build(executionBlueprint = {}, controllerResults = []) {
    const resultByTask = new Map(controllerResults.map(result => [result.taskId, result]));
    return deepFreeze({
      nodes: (executionBlueprint.tasks || []).map(task => ({
        id: task.id,
        action: task.action,
        status: resultByTask.get(task.id)?.success ? 'completed' : resultByTask.has(task.id) ? 'failed' : 'skipped'
      })),
      edges: (executionBlueprint.dependencies || []).map(dependency => ({
        from: dependency.from,
        to: dependency.to,
        type: dependency.type
      }))
    });
  }
}

class AutomationContext {
  constructor({ executionBlueprint = null, decisionResult = null, validationResult = null, automationEngine = null, configuration = {}, metadata = {} } = {}) {
    this.executionBlueprint = executionBlueprint || null;
    this.decisionResult = decisionResult || null;
    this.validationResult = validationResult || null;
    this.automationEngine = automationEngine || null;
    this.configuration = { ...(configuration || {}) };
    this.metadata = { ...(metadata || {}) };
    this.completedActions = [];
    this.failedActions = [];
    this.skippedActions = [];
    this.controllerResults = [];
    this.errors = [];
    this.warnings = [];
    this.diagnostics = new AutomationDiagnostics();
    this.timing = { startedAt: Date.now(), finishedAt: null, durationMs: 0 };
    this.executionStatus = 'NOT_DISPATCHED';
    this.graphBuilder = new AutomationExecutionGraph();
  }

  toAutomationResult() {
    this.timing.finishedAt = this.timing.finishedAt || Date.now();
    this.timing.durationMs = Math.max(0, this.timing.finishedAt - this.timing.startedAt);
    const graph = this.graphBuilder.build(this.executionBlueprint, this.controllerResults);
    this.diagnostics.executionGraph = graph;
    return new AutomationResult({
      decision: this.decisionResult,
      validation: this.validationResult,
      executionStatus: this.executionStatus,
      completedActions: this.completedActions,
      failedActions: this.failedActions,
      skippedActions: this.skippedActions,
      controllerResults: this.controllerResults,
      executionGraph: graph,
      timing: this.timing,
      diagnostics: this.diagnostics.toJSON(),
      errors: this.errors,
      warnings: this.warnings,
      metadata: this.metadata,
      version: this.configuration.version || '10.0.0'
    });
  }
}

const ACTION_ROUTES = Object.freeze({
  OPEN_APPLICATION: 'app.open',
  CLOSE_APPLICATION: 'app.close',
  SEARCH_WEB: 'browser.search',
  PLAY_MEDIA: 'media.play',
  PAUSE_MEDIA: 'media.pause',
  RESUME_MEDIA: 'media.resume',
  STOP_MEDIA: 'media.stop',
  SET_VOLUME: 'volume.set',
  MUTE_AUDIO: 'volume.mute',
  OPEN_FOLDER: 'folder.open',
  OPEN_FILE: 'file.open',
  CREATE_FILE: 'file.create',
  DELETE_FILE: 'file.delete',
  MOVE_FILE: 'file.move',
  CREATE_REMINDER: 'reminder.set'
});

function resolveAutomationRoute(task = {}, routes = ACTION_ROUTES) {
  return task.metadata?.automationAction || routes[task.action] || null;
}

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
      throwIfAborted(options.executionContext?.signal || options.signal || null);
      const task = (executionBlueprint.tasks || []).find(candidate => candidate.id === order.taskId);
      if (!task?.action) continue;
      const route = resolveAutomationRoute(task, this.configuration.routes);
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
        if (isCancellationError(error)) throw error;
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
AutomationDispatcher.resolveAutomationRoute = resolveAutomationRoute;

class AssistantExecutionStage extends PipelineStage {
  constructor(options = {}) {
    super({
      id: options.id || 'assistant.execution',
      name: options.name || 'Assistant Execution',
      order: Number.isFinite(options.order) ? options.order : 0.1,
      enabled: options.enabled !== false
    });
    this.executor = options.executor || null;
  }

  async execute(context) {
    if (typeof this.executor !== 'function') {
      return StageResult.skipped(this.id, 'No assistant executor configured.');
    }

    const commandIntentText = context.get?.('assistant.commandIntentText') || context.normalizedInputObject?.commandIntentText || context.normalizedInputObject?.metadata?.commandIntentText;
    const normalized = String(commandIntentText || context.normalizedInputObject?.normalizedText || '').trim();
    const input = normalized
      ? normalized
      : context.normalizedInput || context.rawInput;
    const options = {
      ...(context.options || {}),
      pipelineContext: context
    };

    const result = await this.executor(input, context.source, options);
    context.set('assistant.result', result);
    context.set('assistant.responsePayload', result);
    context.setStageOutput(this.id, result);
    return StageResult.ok(this.id, result);
  }
}

class NaturalLanguageExecution {
  constructor(automationEngine) {
    this.automation = automationEngine;
  }

  execute(actionId, entities = {}, context = {}) {
    if (!this.automation || typeof this.automation.execute !== 'function') {
      return Promise.resolve({ success: false, error: 'Automation engine is unavailable' });
    }
    const discourse = context?.languageUnderstanding?.discourse;
    const contextualRewrite = context?.contextualRewrite;
    const executionContext = {
      ...context,
      ...(discourse ? { discourse } : {}),
      ...(contextualRewrite ? { contextualRewrite } : {})
    };
    return this.automation.execute(actionId, entities, executionContext);
  }
}

module.exports = {
  ACTION_ROUTES,
  AssistantExecutionStage,
  AutomationContext,
  AutomationDiagnostics,
  AutomationDispatcher,
  AutomationDispatchError,
  AutomationExecutionError,
  AutomationExecutionGraph,
  AutomationResult,
  ConfigurationError,
  NaturalLanguageExecution,
  PipelineError,
  resolveAutomationRoute
};