'use strict';

const { deepFreeze } = require('../utils');
const PipelineStage = require('../pipeline/PipelineStage');
const StageResult = require('../pipeline/StageResult');
const {
  TaskPlanner,
  WorkflowPlanner,
  DependencyPlanner,
  ParallelPlanner,
  RecoveryPlanner,
  ExecutionPlanner,
  PlannerOptimizer,
  TaskGraphBuilder,
  ExecutionGraphBuilder
} = require('./Planners');

const DEFAULT_PLANNER_OPTIONS = Object.freeze({
  enabled: true,
  priority: 100,
  strategy: 'deterministic'
});

class PlanningConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || '9.0.0');
    this.strict = input.strict === true;
    this.strategy = String(input.strategy || 'deterministic');
    this.optimizationLevel = String(input.optimizationLevel || 'safe');
    this.parallelPlanning = input.parallelPlanning !== false;
    this.recoveryPlanning = input.recoveryPlanning !== false;
    this.maxTasks = Number.isFinite(input.maxTasks) ? Math.max(1, Number(input.maxTasks)) : 100;
    this.defaultTaskDurationSeconds = Number.isFinite(input.defaultTaskDurationSeconds)
      ? Math.max(1, Number(input.defaultTaskDurationSeconds))
      : 30;
    this.actionDurations = {
      OPEN_APPLICATION: 10,
      CLOSE_APPLICATION: 8,
      SEARCH_WEB: 15,
      PLAY_MEDIA: 12,
      SET_VOLUME: 4,
      MUTE_AUDIO: 3,
      OPEN_FOLDER: 8,
      OPEN_FILE: 8,
      DELETE_FILE: 12,
      MOVE_FILE: 20,
      CREATE_REMINDER: 10,
      ...(input.actionDurations || {})
    };
    this.sequentialWorkflows = new Set(input.sequentialWorkflows || ['email', 'file', 'system']);
    this.parallelActions = new Set(input.parallelActions || ['OPEN_APPLICATION', 'SEARCH_WEB', 'OPEN_FOLDER', 'OPEN_FILE']);
    this.planners = { ...(input.planners || {}) };
    this.providers = { ...(input.providers || {}) };
  }

  getPlannerOptions(id, defaults = {}) {
    return {
      ...DEFAULT_PLANNER_OPTIONS,
      ...(defaults || {}),
      ...(this.planners[String(id || '')] || {})
    };
  }

  durationForAction(action) {
    return Number(this.actionDurations[String(action || '')]) || this.defaultTaskDurationSeconds;
  }

  toJSON() {
    return {
      enabled: this.enabled,
      version: this.version,
      strict: this.strict,
      strategy: this.strategy,
      optimizationLevel: this.optimizationLevel,
      parallelPlanning: this.parallelPlanning,
      recoveryPlanning: this.recoveryPlanning,
      maxTasks: this.maxTasks,
      defaultTaskDurationSeconds: this.defaultTaskDurationSeconds,
      actionDurations: { ...this.actionDurations },
      sequentialWorkflows: [...this.sequentialWorkflows],
      parallelActions: [...this.parallelActions],
      planners: { ...this.planners }
    };
  }
}

const MAX_DIAGNOSTIC_ITEMS = 100;

function pushBounded(list, item) {
  list.push(item);
  if (list.length > MAX_DIAGNOSTIC_ITEMS) list.splice(0, list.length - MAX_DIAGNOSTIC_ITEMS);
}

class PlanningDiagnostics {
  constructor() {
    this.planningTime = {};
    this.taskCount = 0;
    this.workflowCount = 0;
    this.dependencyCount = 0;
    this.optimizationResults = [];
    this.parallelGroups = 0;
    this.recoveryPlans = 0;
    this.executionOrderCount = 0;
    this.warnings = [];
    this.errors = [];
    this.pipelineOrder = [];
    this.memoryUsage = this._memoryUsage();
    this.finishedMemoryUsage = null;
  }

  time(id, durationMs) {
    this.planningTime[String(id || '')] = Math.max(0, Number(durationMs) || 0);
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

  finish() {
    this.finishedMemoryUsage = this._memoryUsage();
    return this;
  }

  toJSON() {
    return {
      planningTime: { ...this.planningTime },
      taskCount: this.taskCount,
      workflowCount: this.workflowCount,
      dependencyCount: this.dependencyCount,
      optimizationResults: this.optimizationResults.slice(),
      parallelGroups: this.parallelGroups,
      recoveryPlans: this.recoveryPlans,
      executionOrderCount: this.executionOrderCount,
      warnings: this.warnings.slice(),
      errors: this.errors.slice(),
      pipelineOrder: this.pipelineOrder.slice(),
      memoryUsage: this.memoryUsage,
      finishedMemoryUsage: this.finishedMemoryUsage
    };
  }
}

class PlanningError extends Error {
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

class WorkflowPlanningError extends PlanningError {}
class DependencyError extends PlanningError {}
class OptimizationError extends PlanningError {}
class ExecutionBlueprintError extends PlanningError {}
class ConfigurationError extends PlanningError {}
class PlannerExecutionError extends PlanningError {}

class PlanningLogger {
  constructor(logger = null) {
    this.logger = logger || null;
  }

  _safeData(data) {
    if (!data || typeof data !== 'object') return data;
    const copy = { ...data };
    for (const key of Object.keys(copy)) {
      if (/(password|token|secret|key)/i.test(key)) copy[key] = '[REDACTED]';
    }
    return copy;
  }

  debug(message, data) { this.logger?.debug?.(message, this._safeData(data)); }
  info(message, data) { this.logger?.info?.(message, this._safeData(data)); }
  warn(message, data) { this.logger?.warn?.(message, this._safeData(data)); }
  error(message, data) { this.logger?.error?.(message, this._safeData(data)); }
}

class PlanningRegistry {
  constructor() {
    this.planners = new Map();
  }

  register(planner, options = {}) {
    if (!planner || typeof planner.plan !== 'function') {
      throw new ConfigurationError('Planner must provide plan(context).');
    }
    const id = String(options.id || planner.id || planner.constructor?.name || '').trim();
    if (!id) throw new ConfigurationError('Planner id is required.');
    planner.id = id;
    if (Number.isFinite(options.priority)) planner.priority = Number(options.priority);
    if (options.enabled !== undefined) planner.enabled = options.enabled !== false;
    this.planners.set(id, planner);
    return this;
  }

  get(id) {
    return this.planners.get(String(id || '').trim()) || null;
  }

  unregister(id) {
    return this.planners.delete(String(id || '').trim());
  }

  list({ includeDisabled = true } = {}) {
    return [...this.planners.values()]
      .filter(planner => includeDisabled || planner.enabled !== false)
      .sort((left, right) => (Number(left.priority) || 0) - (Number(right.priority) || 0) || String(left.id).localeCompare(String(right.id)));
  }

  health() {
    return this.list().map(planner => ({
      id: planner.id,
      version: planner.version,
      priority: planner.priority,
      enabled: planner.enabled !== false,
      initialized: planner.initialized === true
    }));
  }

  clear() {
    const count = this.planners.size;
    this.planners.clear();
    return count;
  }
}

class ExecutionBlueprint {
  constructor(input = {}) {
    this.tasks = Array.isArray(input.tasks) ? input.tasks.slice() : [];
    this.workflow = input.workflow || { id: 'workflow.empty', type: 'empty', tasks: [] };
    this.dependencies = Array.isArray(input.dependencies) ? input.dependencies.slice() : [];
    this.executionGraph = input.executionGraph || { nodes: [], edges: [] };
    this.taskGraph = input.taskGraph || { nodes: [], edges: [] };
    this.parallelGroups = Array.isArray(input.parallelGroups) ? input.parallelGroups.slice() : [];
    this.recoveryPlan = Array.isArray(input.recoveryPlan) ? input.recoveryPlan.slice() : [];
    this.ordering = Array.isArray(input.ordering) ? input.ordering.slice() : [];
    this.conditions = Array.isArray(input.conditions) ? input.conditions.slice() : [];
    this.optionalTasks = Array.isArray(input.optionalTasks) ? input.optionalTasks.slice() : [];
    this.estimatedComplexity = String(input.estimatedComplexity || 'low');
    this.estimatedDuration = Number(input.estimatedDuration || 0);
    this.planningDiagnostics = input.planningDiagnostics || {};
    this.metadata = { ...(input.metadata || {}) };
    this.actionCounts = { ...(input.actionCounts || {}) };
    this.taskIndex = Object.fromEntries(this.tasks.map(task => [task.id, task]));
    this.ready = this.tasks.length > 0 && this.ordering.length === this.tasks.length;
    this.version = String(input.version || '9.0.0');
    this.futureExtensions = { ...(input.futureExtensions || {}) };
    deepFreeze(this);
  }
}

class PlanningContext {
  constructor({ reasoningResult = null, configuration = null, metadata = {} } = {}) {
    this.reasoningResult = reasoningResult || null;
    this.configuration = configuration || null;
    this.metadata = { ...(metadata || {}) };
    this.tasks = [];
    this.workflow = { id: 'workflow.empty', type: 'empty', tasks: [] };
    this.dependencies = [];
    this.parallelGroups = [];
    this.recoveryPlan = [];
    this.ordering = [];
    this.conditions = [];
    this.optionalTasks = [];
    this.taskGraph = { nodes: [], edges: [] };
    this.executionGraph = { nodes: [], edges: [] };
    this.optimizations = [];
    this.estimatedComplexity = 'low';
    this.estimatedDuration = 0;
    this.diagnostics = new PlanningDiagnostics();
    this.timing = { startedAt: Date.now(), finishedAt: null, durationMs: 0 };
    this.futureExtensions = {};
  }

  _uniqueTaskId(id) {
    const base = String(id || `task.${this.tasks.length + 1}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '') || 'task';
    if (!this.tasks.some(task => task.id === base)) return base;
    let index = 2;
    while (this.tasks.some(task => task.id === `${base}.${index}`)) index += 1;
    return `${base}.${index}`;
  }

  addTask(task = {}) {
    if (this.tasks.length >= (this.configuration?.maxTasks || 100)) {
      this.diagnostics.warn('Task limit reached; dropping additional task.', { maxTasks: this.configuration?.maxTasks || 100, task });
      return null;
    }
    const id = this._uniqueTaskId(task.id);
    const next = {
      id,
      label: String(task.label || id),
      action: task.action || null,
      intent: task.intent || null,
      optional: task.optional === true,
      repeatable: task.repeatable === true,
      retryable: task.retryable !== false,
      cancelable: task.cancelable !== false,
      conditions: Array.isArray(task.conditions) ? task.conditions.slice() : [],
      metadata: { ...(task.metadata || {}) },
      dependsOn: Array.isArray(task.dependsOn || task.metadata?.dependsOn) ? (task.dependsOn || task.metadata.dependsOn).slice() : []
    };
    this.tasks.push(next);
    return next;
  }

  addDependency(from, to, type = 'requires') {
    if (!from || !to || from === to) return null;
    const exists = this.dependencies.some(item => item.from === from && item.to === to && item.type === type);
    if (exists) return null;
    const dependency = { from, to, type };
    this.dependencies.push(dependency);
    return dependency;
  }

  removeInvalidReferences() {
    const ids = new Set(this.tasks.map(task => task.id));
    this.dependencies = this.dependencies.filter(dependency => ids.has(dependency.from) && ids.has(dependency.to));
    this.parallelGroups = this.parallelGroups
      .map(group => ({ ...group, tasks: (group.tasks || []).filter(taskId => ids.has(taskId)) }))
      .filter(group => group.tasks.length > 1);
    this.recoveryPlan = this.recoveryPlan.filter(plan => ids.has(plan.taskId));
    this.ordering = this.ordering.filter(order => ids.has(order.taskId));
    this.conditions = this.conditions.filter(condition => ids.has(condition.taskId));
    this.optionalTasks = this.optionalTasks.filter(taskId => ids.has(taskId));
    if (this.workflow?.tasks) this.workflow.tasks = this.workflow.tasks.filter(taskId => ids.has(taskId));
    return this;
  }

  actionCounts() {
    const counts = {};
    for (const task of this.tasks) {
      const action = String(task.action || 'UNSPECIFIED');
      counts[action] = (counts[action] || 0) + 1;
    }
    return counts;
  }

  toExecutionBlueprint() {
    this.removeInvalidReferences();
    this.timing.finishedAt = this.timing.finishedAt || Date.now();
    this.timing.durationMs = Math.max(0, this.timing.finishedAt - this.timing.startedAt);
    this.diagnostics.finish();
    this.diagnostics.taskCount = this.tasks.length;
    this.diagnostics.workflowCount = this.workflow?.id ? 1 : 0;
    this.diagnostics.dependencyCount = this.dependencies.length;
    this.diagnostics.parallelGroups = this.parallelGroups.length;
    this.diagnostics.recoveryPlans = this.recoveryPlan.length;
    return new ExecutionBlueprint({
      tasks: this.tasks,
      workflow: this.workflow,
      dependencies: this.dependencies,
      executionGraph: this.executionGraph,
      taskGraph: this.taskGraph,
      parallelGroups: this.parallelGroups,
      recoveryPlan: this.recoveryPlan,
      ordering: this.ordering,
      conditions: this.conditions,
      optionalTasks: this.optionalTasks,
      estimatedComplexity: this.estimatedComplexity,
      estimatedDuration: this.estimatedDuration,
      planningDiagnostics: {
        ...this.diagnostics.toJSON(),
        timing: this.timing
      },
      metadata: this.metadata,
      actionCounts: this.actionCounts(),
      version: this.configuration?.version || '9.0.0',
      futureExtensions: this.futureExtensions
    });
  }
}

class PlanningPipeline {
  constructor(options = {}) {
    this.registry = options.registry || new PlanningRegistry();
    this.configuration = options.configuration instanceof PlanningConfiguration
      ? options.configuration
      : new PlanningConfiguration(options.configuration || {});
    this.logger = options.logger || null;
  }

  async run(reasoningResult, options = {}) {
    const context = new PlanningContext({
      reasoningResult,
      configuration: this.configuration,
      metadata: options.metadata || {}
    });
    if (this.configuration.enabled === false) {
      context.diagnostics.warn('Planning pipeline disabled; returning empty execution blueprint.');
      return context.toExecutionBlueprint();
    }

    for (const planner of this.registry.list({ includeDisabled: false })) {
      const started = Date.now();
      context.diagnostics.pipelineOrder.push(planner.id);
      try {
        if (!planner.initialized && typeof planner.initialize === 'function') await planner.initialize();
        if (planner.supports(context)) await planner.plan(context);
        context.removeInvalidReferences();
      } catch (error) {
        const wrapped = new PlannerExecutionError(`Planner failed: ${planner.id}`, { cause: error, context: { plannerId: planner.id } });
        context.diagnostics.error(wrapped);
        if (this.configuration.strict) throw wrapped;
      } finally {
        context.diagnostics.time(planner.id, Date.now() - started);
        if (typeof planner.cleanup === 'function') await planner.cleanup(context);
      }
    }

    return context.toExecutionBlueprint();
  }
}

class PlanningManager {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof PlanningConfiguration
      ? options.configuration
      : new PlanningConfiguration(options.configuration || options);
    this.registry = options.registry || new PlanningRegistry();
    this.pipeline = options.pipeline || null;
    this.logger = options.logger || null;
    if (options.defaultPlanners !== false) this._registerDefaults();
  }

  _registerDefaults() {
    [
      [TaskPlanner, 'planning.taskPlanner', 10],
      [WorkflowPlanner, 'planning.workflowPlanner', 20],
      [DependencyPlanner, 'planning.dependencyPlanner', 30],
      [ParallelPlanner, 'planning.parallelPlanner', 40],
      [RecoveryPlanner, 'planning.recoveryPlanner', 50],
      [PlannerOptimizer, 'planning.optimizer', 60],
      [ExecutionPlanner, 'planning.executionPlanner', 70],
      [TaskGraphBuilder, 'planning.taskGraphBuilder', 80],
      [ExecutionGraphBuilder, 'planning.executionGraphBuilder', 90]
    ].forEach(([Ctor, id, priority]) => {
      const configured = this.configuration.getPlannerOptions(id, { priority });
      this.registry.register(new Ctor({ id, ...configured }), { id, priority: configured.priority, enabled: configured.enabled });
    });
  }

  registerPlanner(planner, options = {}) {
    this.registry.register(planner, options);
    return this;
  }

  async plan(reasoningResult, options = {}) {
    if (!this.pipeline) {
      this.pipeline = new PlanningPipeline({
        registry: this.registry,
        configuration: this.configuration,
        logger: this.logger
      });
    }
    return this.pipeline.run(reasoningResult, {
      ...(options || {}),
      metadata: {
        ...(options.metadata || {}),
        planningManagerVersion: this.configuration.version
      }
    });
  }

  getStatus() {
    return {
      enabled: this.configuration.enabled,
      version: this.configuration.version,
      pipelineReady: Boolean(this.pipeline),
      plannerCount: this.registry.list().length,
      planners: this.registry.health()
    };
  }

  destroy() {
    for (const planner of this.registry.list()) planner.destroy?.();
    this.registry.clear();
    this.pipeline = null;
  }
}

class TaskPlanningStage extends PipelineStage {
  constructor(options = {}) {
    super({
      id: options.id || 'assistant.task.planning',
      name: options.name || 'Assistant Task Planning',
      order: Number.isFinite(options.order) ? options.order : -1,
      enabled: options.enabled !== false
    });
    this.manager = options.manager || createDefaultPlanningManager({
      configuration: options.configuration || {},
      logger: options.logger || null
    });
  }

  async execute(context) {
    if (!context.reasoningResult) {
      return StageResult.skipped(this.id, 'No ReasoningResult available.');
    }
    const executionBlueprint = await this.manager.plan(context.reasoningResult, {
      metadata: {
        ...(context.metadata || {}),
        rawInput: context.rawInput,
        source: context.source
      }
    });
    context.executionBlueprint = executionBlueprint;
    context.set('assistant.executionBlueprint', executionBlueprint);
    return StageResult.ok(this.id, {
      taskCount: executionBlueprint.tasks.length,
      workflow: executionBlueprint.workflow?.type || null,
      dependencyCount: executionBlueprint.dependencies.length,
      ready: executionBlueprint.ready,
      actionCounts: executionBlueprint.actionCounts,
      version: executionBlueprint.version
    });
  }

  async destroy() {
    if (typeof this.manager?.destroy === 'function') this.manager.destroy();
    return super.destroy();
  }
}

function createDefaultPlanningManager(options = {}) {
  return new PlanningManager(options);
}

module.exports = {
  PlanningConfiguration,
  PlanningDiagnostics,
  PlanningError,
  WorkflowPlanningError,
  DependencyError,
  OptimizationError,
  ExecutionBlueprintError,
  ConfigurationError,
  PlannerExecutionError,
  PlanningLogger,
  PlanningRegistry,
  ExecutionBlueprint,
  PlanningContext,
  PlanningPipeline,
  PlanningManager,
  TaskPlanningStage,
  createDefaultPlanningManager
};