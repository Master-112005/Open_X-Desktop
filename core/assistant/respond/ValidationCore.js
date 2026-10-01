'use strict';

// Merged from core/assistant/validation:
// - ValidationErrors.js
// - ValidationResult.js
// - ValidationDiagnostics.js
// - ValidationConfiguration.js
// - ValidationRegistry.js
// - ValidationLogger.js
// - ValidationContext.js
// - BaseValidator.js
// - PermissionValidator.js
// - SafetyValidator.js
// - EntityValidator.js
// - ContextValidator.js
// - ConfirmationValidator.js
// - AutomationValidator.js
// - ConstraintValidator.js
// - ValidationPipeline.js
// - ValidationManager.js

const { deepFreeze } = require('../shared/UtilsCore');

class ValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = details.context || null;
    this.diagnostics = details.diagnostics || [];
    this.code = details.code || this.constructor.name;
    this.timestamp = Date.now();
    if (details.cause) this.cause = details.cause;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      diagnostics: this.diagnostics,
      timestamp: this.timestamp
    };
  }
}

class PermissionError extends ValidationError {}
class SafetyError extends ValidationError {}
class ConfigurationError extends ValidationError {}
class PipelineError extends ValidationError {}

class ValidationResult {
  constructor(input = {}) {
    this.valid = input.valid !== false;
    this.checks = Array.isArray(input.checks) ? input.checks.slice() : [];
    this.errors = Array.isArray(input.errors) ? input.errors.slice() : [];
    this.warnings = Array.isArray(input.warnings) ? input.warnings.slice() : [];
    this.metadata = { ...(input.metadata || {}) };
    this.summary = { ...(input.summary || {}) };
    this.diagnostics = input.diagnostics || {};
    this.version = String(input.version || '10.0.0');
    this.futureExtensions = { ...(input.futureExtensions || {}) };
    deepFreeze(this);
  }
}

const MAX_DIAGNOSTIC_ITEMS = 100;

function pushBounded(list, item) {
  list.push(item);
  if (list.length > MAX_DIAGNOSTIC_ITEMS) list.splice(0, list.length - MAX_DIAGNOSTIC_ITEMS);
}

class ValidationDiagnostics {
  constructor() {
    this.startedAt = Date.now();
    this.finishedAt = null;
    this.validationTime = {};
    this.warnings = [];
    this.errors = [];
    this.pipelineOrder = [];
    this.memoryUsage = this._memoryUsage();
  }

  time(id, durationMs) {
    this.validationTime[String(id || '')] = Math.max(0, Number(durationMs) || 0);
  }

  finish() {
    this.finishedAt = Date.now();
    this.memoryUsage = this._memoryUsage();
    return this;
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
    this.finish();
    return {
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      durationMs: Math.max(0, (this.finishedAt || Date.now()) - this.startedAt),
      validationTime: { ...this.validationTime },
      warnings: this.warnings.slice(),
      errors: this.errors.slice(),
      pipelineOrder: this.pipelineOrder.slice(),
      memoryUsage: this.memoryUsage
    };
  }
}

const DEFAULT_VALIDATOR_OPTIONS = Object.freeze({
  enabled: true,
  priority: 100
});

class ValidationConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || '10.0.0');
    this.strict = input.strict === true;
    this.maxChecks = Number.isFinite(input.maxChecks) ? Math.max(50, Number(input.maxChecks)) : 1000;
    this.validators = { ...(input.validators || {}) };
    this.permissions = { ...(input.permissions || {}) };
    this.allowedActions = Array.isArray(input.allowedActions) ? input.allowedActions.slice() : null;
    this.deniedActions = Array.isArray(input.deniedActions) ? input.deniedActions.slice() : [];
    this.safety = {
      dangerousActions: new Set(input.safety?.dangerousActions || ['DELETE_FILE', 'FORMAT_DRIVE', 'SYSTEM_SHUTDOWN', 'SYSTEM_RESTART']),
      ...(input.safety || {})
    };
    if (!(this.safety.dangerousActions instanceof Set)) {
      this.safety.dangerousActions = new Set(this.safety.dangerousActions || []);
    }
  }

  getValidatorOptions(id, defaults = {}) {
    return {
      ...DEFAULT_VALIDATOR_OPTIONS,
      ...(defaults || {}),
      ...(this.validators[String(id || '')] || {})
    };
  }

  toJSON() {
    return {
      enabled: this.enabled,
      version: this.version,
      strict: this.strict,
      maxChecks: this.maxChecks,
      validators: { ...this.validators },
      permissions: { ...this.permissions },
      allowedActions: this.allowedActions ? this.allowedActions.slice() : null,
      deniedActions: this.deniedActions.slice(),
      safety: {
        ...this.safety,
        dangerousActions: [...(this.safety.dangerousActions || [])]
      }
    };
  }
}

class ValidationRegistry {
  constructor() {
    this.validators = new Map();
  }

  register(validator, options = {}) {
    if (!validator || typeof validator.validate !== 'function') {
      throw new ConfigurationError('Validator must provide validate(context).');
    }
    const id = String(options.id || validator.id || validator.constructor?.name || '').trim();
    if (!id) throw new ConfigurationError('Validator id is required.');
    validator.id = id;
    if (Number.isFinite(options.priority)) validator.priority = Number(options.priority);
    if (options.enabled !== undefined) validator.enabled = options.enabled !== false;
    this.validators.set(id, validator);
    return this;
  }

  list({ includeDisabled = true } = {}) {
    return [...this.validators.values()]
      .filter(validator => includeDisabled || validator.enabled !== false)
      .sort((left, right) => (Number(left.priority) || 0) - (Number(right.priority) || 0) || String(left.id).localeCompare(String(right.id)));
  }

  get(id) {
    return this.validators.get(String(id || '').trim()) || null;
  }

  unregister(id) {
    return this.validators.delete(String(id || '').trim());
  }

  count({ includeDisabled = true } = {}) {
    return this.list({ includeDisabled }).length;
  }

  health() {
    return this.list().map(validator => ({
      id: validator.id,
      version: validator.version,
      priority: validator.priority,
      enabled: validator.enabled !== false,
      initialized: validator.initialized === true
    }));
  }

  clear() {
    const count = this.validators.size;
    this.validators.clear();
    return count;
  }
}

class ValidationLogger {
  constructor(logger = null) {
    this.logger = logger || null;
  }

  _safe(data) {
    if (!data || typeof data !== 'object') return data;
    const copy = { ...data };
    for (const key of Object.keys(copy)) {
      if (/(password|token|secret|key|email|phone|messageText)/i.test(key)) copy[key] = '[REDACTED]';
    }
    return copy;
  }

  debug(message, data) { this.logger?.debug?.(`[Validation] ${message}`, this._safe(data)); }
  info(message, data) { this.logger?.info?.(`[Validation] ${message}`, this._safe(data)); }
  warn(message, data) { this.logger?.warn?.(`[Validation] ${message}`, this._safe(data)); }
  error(message, data) { this.logger?.error?.(`[Validation] ${message}`, this._safe(data)); }
}

class ValidationContext {
  constructor({ executionBlueprint = null, decisionResult = null, automationEngine = null, configuration = null, metadata = {} } = {}) {
    this.executionBlueprint = executionBlueprint || null;
    this.decisionResult = decisionResult || null;
    this.automationEngine = automationEngine || null;
    this.configuration = configuration || null;
    this.metadata = {
      source: metadata.source || metadata.sourceType || 'chat',
      ...(metadata || {})
    };
    this.checks = [];
    this.errors = [];
    this.warnings = [];
    this.diagnostics = new ValidationDiagnostics();
    this.futureExtensions = {};
  }

  check(id, valid, message = '', data = {}) {
    const record = {
      id: String(id || 'validation'),
      valid: valid !== false,
      message: String(message || ''),
      data: { ...(data || {}) },
      timestamp: Date.now()
    };
    this.checks.push(record);
    if (this.configuration?.maxChecks && this.checks.length > this.configuration.maxChecks) {
      this.checks.splice(0, this.checks.length - this.configuration.maxChecks);
    }
    if (!record.valid) this.errors.push(record);
    return record;
  }

  warn(id, message, data = {}) {
    const record = { id: String(id || 'validation'), message: String(message || ''), data: { ...(data || {}) }, timestamp: Date.now() };
    this.warnings.push(record);
    this.diagnostics.warn(message, data);
    return record;
  }

  tasks() {
    return Array.isArray(this.executionBlueprint?.tasks) ? this.executionBlueprint.tasks : [];
  }

  actionCounts() {
    return this.tasks().reduce((counts, task) => {
      const action = String(task.action || 'UNKNOWN');
      counts[action] = (counts[action] || 0) + 1;
      return counts;
    }, {});
  }

  summary() {
    return {
      valid: this.errors.length === 0,
      taskCount: this.tasks().length,
      checkCount: this.checks.length,
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      actionCounts: this.actionCounts()
    };
  }

  toValidationResult() {
    return new ValidationResult({
      valid: this.errors.length === 0,
      checks: this.checks,
      errors: this.errors,
      warnings: this.warnings,
      metadata: this.metadata,
      summary: this.summary(),
      diagnostics: this.diagnostics.toJSON(),
      version: this.configuration?.version || '10.0.0',
      futureExtensions: this.futureExtensions
    });
  }
}

class BaseValidator {
  constructor(options = {}) {
    this.id = String(options.id || this.constructor.name);
    this.name = String(options.name || this.id);
    this.priority = Number.isFinite(options.priority) ? Number(options.priority) : 100;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.options = { ...(options || {}) };
    this.initialized = false;
  }

  initialize() {
    this.initialized = true;
    return true;
  }

  supports(context) {
    return this.enabled && !!context;
  }

  tasks(context) {
    return Array.isArray(context?.executionBlueprint?.tasks)
      ? context.executionBlueprint.tasks
      : [];
  }

  entities(context, task = null) {
    return {
      ...(context?.executionBlueprint?.metadata?.entities || {}),
      ...(task?.metadata?.entities || {})
    };
  }

  fail(context, message, data = {}) {
    return context.check(this.id, false, message, data);
  }

  pass(context, message, data = {}) {
    return context.check(this.id, true, message, data);
  }

  warn(context, message, data = {}) {
    return context.warn(this.id, message, data);
  }

  validate(context) {
    return context;
  }

  cleanup() {
    return true;
  }

  destroy() {
    this.initialized = false;
    return true;
  }
}

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

class SafetyValidator extends BaseValidator {
  validate(context) {
    const dangerous = context.configuration?.safety?.dangerousActions || new Set();
    let foundDangerous = false;
    for (const task of this.tasks(context)) {
      const highRisk = task.metadata?.risk === 'high';
      if (!dangerous.has(task.action) && !highRisk) continue;
      foundDangerous = true;
      const confirmed = context.metadata.confirmed === true;
      context.check(this.id, confirmed, confirmed ? 'dangerous action confirmed' : 'dangerous action requires confirmation', {
        taskId: task.id,
        action: task.action,
        risk: task.metadata?.risk || null
      });
    }
    if (!foundDangerous) {
      context.check(this.id, true, 'no dangerous actions');
    }
    return context;
  }
}

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

class ContextValidator extends BaseValidator {
  validate(context) {
    const blueprint = context.executionBlueprint || {};
    context.check(this.id, Boolean(blueprint && typeof blueprint === 'object'), 'execution blueprint present');
    context.check(this.id, Array.isArray(blueprint.tasks), 'blueprint tasks array present');
    context.check(this.id, Array.isArray(blueprint.ordering), 'blueprint ordering array present');
    context.check(this.id, Boolean(blueprint.workflow?.type), 'workflow type present', {
      workflow: blueprint.workflow?.type || null
    });
    context.check(this.id, Boolean(context.metadata.source || context.metadata.sourceType), 'source metadata present', {
      source: context.metadata.source || context.metadata.sourceType || null
    });
    return context;
  }
}

class ConfirmationValidator extends BaseValidator {
  validate(context) {
    const required = Array.isArray(context.decisionResult?.confirmationRequired)
      ? context.decisionResult.confirmationRequired
      : [];
    const confirmedTasks = new Set(context.metadata.confirmedTasks || []);
    const valid = required.length === 0 ||
      context.metadata.confirmed === true ||
      required.every(item => confirmedTasks.has(item.taskId));
    context.check(this.id, valid, valid ? 'confirmation satisfied' : 'confirmation required', {
      required,
      confirmedTasks: [...confirmedTasks]
    });
    return context;
  }
}

const { AutomationDispatcher } = require('../automation/AutomationRuntime');

class AutomationValidator extends BaseValidator {
  validate(context) {
    const actions = typeof context.automationEngine?.getActions === 'function'
      ? new Set(context.automationEngine.getActions())
      : null;
    const routes = context.metadata?.automationRoutes || AutomationDispatcher.ACTION_ROUTES;
    const tasks = this.tasks(context);
    if (tasks.length === 0) {
      context.check(this.id, false, 'no automation tasks to validate');
      return context;
    }
    for (const task of tasks) {
      if (!task.action) {
        context.check(this.id, false, 'task action missing', { taskId: task.id || null });
        continue;
      }
      const route = AutomationDispatcher.resolveAutomationRoute(task, routes);
      const routeKnown = Boolean(route);
      const controllerAvailable = !actions || (route && actions.has(route));
      context.check(this.id, routeKnown && controllerAvailable, routeKnown && controllerAvailable
        ? 'automation route available'
        : 'automation route unavailable', {
          taskId: task.id,
          action: task.action,
          route,
          routeKnown,
          controllerAvailable
        });
    }
    return context;
  }
}

AutomationValidator.ACTION_ROUTES = AutomationDispatcher.ACTION_ROUTES;

class ConstraintValidator extends BaseValidator {
  validate(context) {
    const taskIds = new Set((context.executionBlueprint?.tasks || []).map(task => task.id));
    context.check(this.id, taskIds.size === (context.executionBlueprint?.tasks || []).length, 'task ids are unique', {
      taskCount: (context.executionBlueprint?.tasks || []).length,
      uniqueTaskCount: taskIds.size
    });
    for (const dependency of context.executionBlueprint?.dependencies || []) {
      context.check(this.id, taskIds.has(dependency.from) && taskIds.has(dependency.to), 'dependency endpoints exist', dependency);
    }
    for (const order of context.executionBlueprint?.ordering || []) {
      context.check(this.id, taskIds.has(order.taskId), 'ordering task exists', order);
    }
    const cycle = this._findCycle(context.executionBlueprint?.dependencies || []);
    context.check(this.id, !cycle, cycle ? 'dependency graph has cycle' : 'dependency graph acyclic', { cycle });
    if ((context.executionBlueprint?.dependencies || []).length === 0) {
      context.check(this.id, true, 'no dependency constraints');
    }
    return context;
  }

  _findCycle(dependencies) {
    const graph = new Map();
    for (const dependency of dependencies) {
      if (!dependency?.from || !dependency?.to) continue;
      if (!graph.has(dependency.from)) graph.set(dependency.from, []);
      graph.get(dependency.from).push(dependency.to);
    }
    const visiting = new Set();
    const visited = new Set();
    const visit = node => {
      if (visiting.has(node)) return node;
      if (visited.has(node)) return null;
      visiting.add(node);
      for (const next of graph.get(node) || []) {
        const cycle = visit(next);
        if (cycle) return cycle;
      }
      visiting.delete(node);
      visited.add(node);
      return null;
    };
    for (const node of graph.keys()) {
      const cycle = visit(node);
      if (cycle) return cycle;
    }
    return null;
  }
}

class ValidationPipeline {
  constructor(options = {}) {
    this.registry = options.registry || new ValidationRegistry();
    this.configuration = options.configuration instanceof ValidationConfiguration
      ? options.configuration
      : new ValidationConfiguration(options.configuration || {});
    this.logger = options.logger instanceof ValidationLogger ? options.logger : new ValidationLogger(options.logger || null);
  }

  async run(executionBlueprint, decisionResult, options = {}) {
    const context = new ValidationContext({
      executionBlueprint,
      decisionResult,
      automationEngine: options.automationEngine || null,
      configuration: this.configuration,
      metadata: options.metadata || {}
    });
    if (this.configuration.enabled === false) return context.toValidationResult();

    for (const validator of this.registry.list({ includeDisabled: false })) {
      const started = Date.now();
      context.diagnostics.pipelineOrder.push(validator.id);
      try {
        if (!validator.initialized && typeof validator.initialize === 'function') await validator.initialize();
        if (validator.supports(context)) await validator.validate(context);
      } catch (error) {
        const wrapped = new PipelineError(`Validator failed: ${validator.id}`, { cause: error, context: { validatorId: validator.id } });
        context.diagnostics.error(wrapped);
        context.check(validator.id, false, wrapped.message, { validatorId: validator.id });
        this.logger.warn(wrapped.message, { validatorId: validator.id });
        if (this.configuration.strict) throw wrapped;
      } finally {
        context.diagnostics.time(validator.id, Date.now() - started);
        if (typeof validator.cleanup === 'function') await validator.cleanup(context);
      }
    }

    return context.toValidationResult();
  }
}

class ValidationManager {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof ValidationConfiguration
      ? options.configuration
      : new ValidationConfiguration(options.configuration || options);
    this.registry = options.registry || new ValidationRegistry();
    this.pipeline = options.pipeline || null;
    this.logger = options.logger instanceof ValidationLogger ? options.logger : new ValidationLogger(options.logger || null);
    if (options.defaultValidators !== false) this._registerDefaults();
  }

  _registerDefaults() {
    [
      [PermissionValidator, 'validation.permission', 10],
      [SafetyValidator, 'validation.safety', 20],
      [EntityValidator, 'validation.entity', 30],
      [ContextValidator, 'validation.context', 40],
      [ConfirmationValidator, 'validation.confirmation', 50],
      [AutomationValidator, 'validation.automation', 60],
      [ConstraintValidator, 'validation.constraint', 70]
    ].forEach(([Ctor, id, priority]) => {
      const configured = this.configuration.getValidatorOptions(id, { priority });
      this.registry.register(new Ctor({ id, ...configured }), { id, priority: configured.priority, enabled: configured.enabled });
    });
  }

  registerValidator(validator, options = {}) {
    this.registry.register(validator, options);
    return this;
  }

  async validate(executionBlueprint, decisionResult, options = {}) {
    if (!this.pipeline) {
      this.pipeline = new ValidationPipeline({
        registry: this.registry,
        configuration: this.configuration,
        logger: this.logger
      });
    }
    return this.pipeline.run(executionBlueprint, decisionResult, options);
  }

  getStatus() {
    return {
      enabled: this.configuration.enabled,
      version: this.configuration.version,
      pipelineReady: Boolean(this.pipeline),
      validatorCount: this.registry.count(),
      validators: this.registry.health()
    };
  }

  destroy() {
    for (const validator of this.registry.list()) validator.destroy?.();
    this.registry.clear();
    this.pipeline = null;
  }
}

function createDefaultValidationManager(options = {}) {
  return new ValidationManager(options);
}

module.exports = {
  ValidationError,
  PermissionError,
  SafetyError,
  ConfigurationError,
  PipelineError,
  ValidationResult,
  ValidationDiagnostics,
  ValidationConfiguration,
  ValidationRegistry,
  ValidationLogger,
  ValidationContext,
  BaseValidator,
  PermissionValidator,
  SafetyValidator,
  EntityValidator,
  ContextValidator,
  ConfirmationValidator,
  AutomationValidator,
  ConstraintValidator,
  ValidationPipeline,
  ValidationManager,
  createDefaultValidationManager
};