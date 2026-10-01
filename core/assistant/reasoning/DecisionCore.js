'use strict';

const { deepFreeze } = require('../shared/UtilsCore');

class DecisionError extends Error {
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

class ConfigurationError extends DecisionError {}
class PipelineError extends DecisionError {}

const DEFAULT_DECISION_OPTIONS = Object.freeze({
  enabled: true,
  priority: 100
});

class DecisionConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || '10.0.0');
    this.strict = input.strict === true;
    this.shortCircuit = input.shortCircuit !== false;
    this.maxTasks = Number.isFinite(input.maxTasks) ? Math.max(1, Number(input.maxTasks)) : 100;
    this.confirmationActions = new Set(input.confirmationActions || [
      'DELETE_FILE',
      'DELETE_FOLDER',
      'PERMANENT_DELETE_FILE',
      'EMPTY_RECYCLE_BIN',
      'SYSTEM_SHUTDOWN',
      'SYSTEM_RESTART',
      'SYSTEM_SIGN_OUT',
      'FORMAT_DRIVE',
      'SEND_EMAIL'
    ]);
    this.disabledActions = new Set(input.disabledActions || []);
    this.allowedActions = Array.isArray(input.allowedActions) && input.allowedActions.length > 0
      ? new Set(input.allowedActions)
      : null;
    this.conflictRules = Array.isArray(input.conflictRules) ? input.conflictRules.slice() : [];
    this.decisions = { ...(input.decisions || {}) };
  }

  getDecisionOptions(id, defaults = {}) {
    return {
      ...DEFAULT_DECISION_OPTIONS,
      ...(defaults || {}),
      ...(this.decisions[String(id || '')] || {})
    };
  }

  toJSON() {
    return {
      enabled: this.enabled,
      version: this.version,
      strict: this.strict,
      shortCircuit: this.shortCircuit,
      maxTasks: this.maxTasks,
      confirmationActions: [...this.confirmationActions],
      disabledActions: [...this.disabledActions],
      allowedActions: this.allowedActions ? [...this.allowedActions] : null,
      conflictRules: this.conflictRules.slice(),
      decisions: { ...this.decisions }
    };
  }
}

const MAX_DIAGNOSTIC_ITEMS = 100;

function pushBounded(list, item) {
  list.push(item);
  if (list.length > MAX_DIAGNOSTIC_ITEMS) list.splice(0, list.length - MAX_DIAGNOSTIC_ITEMS);
}

class DecisionDiagnostics {
  constructor() {
    this.decisionTime = {};
    this.policyDecisions = [];
    this.confirmationRequests = [];
    this.warnings = [];
    this.errors = [];
    this.pipelineOrder = [];
    this.memoryUsage = this._memoryUsage();
    this.finishedMemoryUsage = null;
  }

  time(id, durationMs) {
    this.decisionTime[String(id || '')] = Math.max(0, Number(durationMs) || 0);
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
      decisionTime: { ...this.decisionTime },
      policyDecisions: this.policyDecisions.slice(),
      confirmationRequests: this.confirmationRequests.slice(),
      warnings: this.warnings.slice(),
      errors: this.errors.slice(),
      pipelineOrder: this.pipelineOrder.slice(),
      memoryUsage: this.memoryUsage,
      finishedMemoryUsage: this.finishedMemoryUsage
    };
  }
}

class DecisionLogger {
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

const DECISION_STATUSES = Object.freeze({
  WAIT: 'WAIT',
  EXECUTE: 'EXECUTE',
  CONFIRM: 'CONFIRM',
  CLARIFY: 'CLARIFY',
  REJECT: 'REJECT'
});

class DecisionResult {
  constructor(input = {}) {
    this.status = String(input.status || 'WAIT');
    this.ready = this.status === 'EXECUTE';
    this.reasons = Array.isArray(input.reasons) ? input.reasons.slice() : [];
    this.clarificationRequirements = Array.isArray(input.clarificationRequirements) ? input.clarificationRequirements.slice() : [];
    this.confirmationRequired = Array.isArray(input.confirmationRequired) ? input.confirmationRequired.slice() : [];
    this.policyResults = Array.isArray(input.policyResults) ? input.policyResults.slice() : [];
    this.conflicts = Array.isArray(input.conflicts) ? input.conflicts.slice() : [];
    this.blockers = Array.isArray(input.blockers) ? input.blockers.slice() : [];
    this.metadata = { ...(input.metadata || {}) };
    this.diagnostics = input.diagnostics || {};
    this.taskCount = Math.max(0, Number(input.taskCount) || 0);
    this.actionCounts = { ...(input.actionCounts || {}) };
    this.blocked = this.status !== 'EXECUTE';
    this.version = String(input.version || '10.0.0');
    this.futureExtensions = { ...(input.futureExtensions || {}) };
    deepFreeze(this);
  }
}

DecisionResult.STATUSES = DECISION_STATUSES;

class DecisionContext {
  constructor({ executionBlueprint = null, configuration = null, metadata = {} } = {}) {
    this.executionBlueprint = executionBlueprint || null;
    this.configuration = configuration || null;
    this.metadata = { ...(metadata || {}) };
    this.status = 'WAIT';
    this.reasons = [];
    this.clarificationRequirements = [];
    this.confirmationRequired = [];
    this.policyResults = [];
    this.conflicts = [];
    this.blockers = [];
    this.diagnostics = new DecisionDiagnostics();
    this.futureExtensions = {};
  }

  setStatus(status, reason = '', options = {}) {
    const rank = { WAIT: 1, EXECUTE: 2, CONFIRM: 3, CLARIFY: 4, REJECT: 5 };
    if (options.force === true || (rank[status] || 0) >= (rank[this.status] || 0)) this.status = status;
    if (reason) this.reasons.push(reason);
    return this;
  }

  addBlocker(type, details = {}, status = 'CLARIFY') {
    const blocker = {
      type: String(type || 'decision-blocker'),
      ...(details || {})
    };
    this.blockers.push(blocker);
    this.diagnostics.warn(`Decision blocker: ${blocker.type}`, blocker);
    this.setStatus(status, blocker.reason || blocker.type);
    return blocker;
  }

  addClarification(requirement = {}) {
    const key = `${requirement.taskId || ''}:${requirement.field || requirement.type || requirement.reason || ''}`;
    if (!this.clarificationRequirements.some(item => `${item.taskId || ''}:${item.field || item.type || item.reason || ''}` === key)) {
      this.clarificationRequirements.push({ ...(requirement || {}) });
    }
    this.setStatus('CLARIFY', requirement.reason || 'clarification required before execution');
    return this;
  }

  addConfirmation(request = {}) {
    const key = `${request.taskId || ''}:${request.action || ''}:${request.reason || ''}`;
    if (!this.confirmationRequired.some(item => `${item.taskId || ''}:${item.action || ''}:${item.reason || ''}` === key)) {
      this.confirmationRequired.push({ ...(request || {}) });
      this.diagnostics.confirmationRequests.push({ ...(request || {}) });
    }
    this.setStatus('CONFIRM', request.reason || 'confirmation required before execution');
    return this;
  }

  addPolicyResult(result = {}) {
    this.policyResults.push({ ...(result || {}) });
    this.diagnostics.policyDecisions.push({ ...(result || {}) });
    if (result.allowed === false) this.setStatus('REJECT', result.reason || 'policy rejected execution');
    return this;
  }

  addConflict(conflict = {}) {
    this.conflicts.push({ ...(conflict || {}) });
    this.setStatus('CLARIFY', conflict.reason || 'execution conflict requires clarification');
    return this;
  }

  get taskCount() {
    return Array.isArray(this.executionBlueprint?.tasks) ? this.executionBlueprint.tasks.length : 0;
  }

  get actionCounts() {
    const counts = {};
    for (const task of this.executionBlueprint?.tasks || []) {
      const action = String(task.action || 'UNKNOWN');
      counts[action] = (counts[action] || 0) + 1;
    }
    return counts;
  }

  toDecisionResult() {
    this.diagnostics.finish();
    return new DecisionResult({
      status: this.status,
      reasons: this.reasons,
      clarificationRequirements: this.clarificationRequirements,
      confirmationRequired: this.confirmationRequired,
      policyResults: this.policyResults,
      conflicts: this.conflicts,
      blockers: this.blockers,
      metadata: this.metadata,
      diagnostics: this.diagnostics.toJSON(),
      taskCount: this.taskCount,
      actionCounts: this.actionCounts,
      version: this.configuration?.version || '10.0.0',
      futureExtensions: this.futureExtensions
    });
  }
}

class DecisionRegistry {
  constructor() {
    this.decisions = new Map();
  }

  register(decision, options = {}) {
    if (!decision || typeof decision.decide !== 'function') {
      throw new ConfigurationError('Decision component must provide decide(context).');
    }
    const id = String(options.id || decision.id || decision.constructor?.name || '').trim();
    if (!id) throw new ConfigurationError('Decision component id is required.');
    decision.id = id;
    if (Number.isFinite(options.priority)) decision.priority = Number(options.priority);
    if (options.enabled !== undefined) decision.enabled = options.enabled !== false;
    this.decisions.set(id, decision);
    return this;
  }

  get(id) {
    return this.decisions.get(String(id || '').trim()) || null;
  }

  unregister(id) {
    return this.decisions.delete(String(id || '').trim());
  }

  list({ includeDisabled = true } = {}) {
    return [...this.decisions.values()]
      .filter(decision => includeDisabled || decision.enabled !== false)
      .sort((left, right) => (Number(left.priority) || 0) - (Number(right.priority) || 0) || String(left.id).localeCompare(String(right.id)));
  }

  health() {
    return this.list().map(decision => ({
      id: decision.id,
      version: decision.version,
      priority: decision.priority,
      enabled: decision.enabled !== false,
      initialized: decision.initialized === true
    }));
  }

  clear() {
    const count = this.decisions.size;
    this.decisions.clear();
    return count;
  }
}

class BaseDecision {
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

  decide(context) {
    return context;
  }

  cleanup() {
    return true;
  }

  tasks(context) {
    return Array.isArray(context?.executionBlueprint?.tasks)
      ? context.executionBlueprint.tasks
      : [];
  }

  taskEntities(task = {}, context = null) {
    return {
      ...(context?.executionBlueprint?.metadata?.entities || {}),
      ...(task.metadata?.entities || {})
    };
  }

  actionTarget(task = {}, context = null) {
    const entities = this.taskEntities(task, context);
    return String(
      entities.appName ||
      entities.filename ||
      entities.folderName ||
      entities.windowName ||
      entities.path ||
      entities.query ||
      task.metadata?.target ||
      ''
    ).trim().toLowerCase();
  }

  destroy() {
    this.initialized = false;
    return true;
  }
}

class DecisionEngine extends BaseDecision {
  decide(context) {
    const blueprint = context.executionBlueprint || {};
    if (!Array.isArray(blueprint.tasks) || blueprint.tasks.length === 0) {
      context.setStatus('WAIT', 'execution blueprint has no tasks');
      return context;
    }
    if (blueprint.tasks.length > context.configuration.maxTasks) {
      context.addBlocker('too-many-tasks', {
        taskCount: blueprint.tasks.length,
        maxTasks: context.configuration.maxTasks,
        reason: 'execution blueprint has too many tasks'
      }, 'REJECT');
      return context;
    }
    const seen = new Set();
    for (const task of blueprint.tasks) {
      if (!task?.id || !task?.action) {
        context.addBlocker('invalid-task', {
          taskId: task?.id || '',
          action: task?.action || '',
          reason: 'execution blueprint contains a task without id or action'
        }, 'REJECT');
        return context;
      }
      if (seen.has(task.id)) {
        context.addBlocker('duplicate-task-id', {
          taskId: task.id,
          reason: 'execution blueprint contains duplicate task ids'
        }, 'REJECT');
        return context;
      }
      seen.add(task.id);
    }
    context.setStatus('EXECUTE', 'execution blueprint contains tasks');
    return context;
  }
}

class ExecutionDecision extends BaseDecision {
  decide(context) {
    const blueprint = context.executionBlueprint || {};
    const taskIds = new Set((blueprint.tasks || []).map(task => task.id));
    const missing = (blueprint.dependencies || []).filter(dependency => !taskIds.has(dependency.from) || !taskIds.has(dependency.to));
    if (missing.length > 0) {
      context.addBlocker('missing-dependencies', {
        dependencies: missing,
        reason: 'execution blueprint has missing dependencies'
      }, 'REJECT');
      context.futureExtensions.missingDependencies = missing;
    }
    const cycle = this._findCycle(blueprint.dependencies || []);
    if (cycle.length > 0) {
      context.addBlocker('dependency-cycle', {
        cycle,
        reason: 'execution blueprint has a dependency cycle'
      }, 'REJECT');
      context.futureExtensions.dependencyCycle = cycle;
    }
    return context;
  }

  _findCycle(dependencies = []) {
    const graph = new Map();
    for (const dependency of dependencies) {
      if (!dependency?.from || !dependency?.to) continue;
      if (!graph.has(dependency.from)) graph.set(dependency.from, []);
      graph.get(dependency.from).push(dependency.to);
    }
    const visiting = new Set();
    const visited = new Set();
    const path = [];

    const visit = node => {
      if (visiting.has(node)) {
        const start = path.indexOf(node);
        return start >= 0 ? path.slice(start).concat(node) : [node];
      }
      if (visited.has(node)) return [];
      visiting.add(node);
      path.push(node);
      for (const next of graph.get(node) || []) {
        const cycle = visit(next);
        if (cycle.length > 0) return cycle;
      }
      path.pop();
      visiting.delete(node);
      visited.add(node);
      return [];
    };

    for (const node of graph.keys()) {
      const cycle = visit(node);
      if (cycle.length > 0) return cycle;
    }
    return [];
  }
}

class ClarificationDecision extends BaseDecision {
  decide(context) {
    const metadataRequirements = context.executionBlueprint?.metadata?.clarificationRequirements || [];
    const requirements = Array.isArray(metadataRequirements) ? metadataRequirements.slice() : [];
    for (const task of this.tasks(context)) {
      const taskRequirements = task.metadata?.clarificationRequirements || task.metadata?.missingEntities || [];
      if (Array.isArray(taskRequirements)) {
        taskRequirements.forEach(requirement => requirements.push({
          taskId: task.id,
          action: task.action,
          ...(typeof requirement === 'string' ? { field: requirement } : requirement)
        }));
      }
      if (task.metadata?.needsClarification === true) {
        requirements.push({
          taskId: task.id,
          action: task.action,
          reason: task.metadata?.clarificationReason || 'task requires clarification'
        });
      }
    }
    if (requirements.length > 0) {
      requirements.forEach(requirement => context.addClarification(requirement));
    }
    return context;
  }
}

class ConfirmationDecision extends BaseDecision {
  decide(context) {
    const confirmationActions = context.configuration?.confirmationActions || new Set();
    const confirmed = context.metadata.confirmed === true;
    for (const task of this.tasks(context)) {
      const requiresConfirmation = confirmationActions.has(task.action) ||
        task.metadata?.requiresConfirmation === true ||
        task.metadata?.dangerous === true ||
        task.metadata?.risk === 'high';
      if (!requiresConfirmation) continue;
      if (confirmed) continue;
      const request = {
        taskId: task.id,
        action: task.action,
        target: this.actionTarget(task, context),
        reason: task.metadata?.confirmationReason || 'action requires explicit confirmation'
      };
      context.addConfirmation(request);
    }
    return context;
  }
}

class PolicyDecision extends BaseDecision {
  decide(context) {
    const disabled = context.configuration?.disabledActions || new Set();
    const allowed = context.configuration?.allowedActions || null;
    for (const task of this.tasks(context)) {
      const explicitlyDisabled = disabled.has('*') || disabled.has(task.action);
      const notAllowed = allowed && !allowed.has(task.action);
      const metadataBlocked = task.metadata?.disabled === true || task.metadata?.policy?.allowed === false;
      if (!explicitlyDisabled && !notAllowed && !metadataBlocked) continue;
      const result = {
        taskId: task.id,
        action: task.action,
        target: this.actionTarget(task, context),
        policy: notAllowed ? 'action-not-allowed' : metadataBlocked ? 'metadata-policy' : 'disabled-action',
        allowed: false,
        reason: task.metadata?.policy?.reason || 'policy rejected execution'
      };
      context.addPolicyResult(result);
    }
    return context;
  }
}

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

class DecisionPipeline {
  constructor(options = {}) {
    this.registry = options.registry || new DecisionRegistry();
    this.configuration = options.configuration instanceof DecisionConfiguration
      ? options.configuration
      : new DecisionConfiguration(options.configuration || {});
  }

  async run(executionBlueprint, options = {}) {
    const context = new DecisionContext({
      executionBlueprint,
      configuration: this.configuration,
      metadata: options.metadata || {}
    });
    if (this.configuration.enabled === false) {
      const hasTasks = Array.isArray(executionBlueprint?.tasks) && executionBlueprint.tasks.length > 0;
      context.setStatus(hasTasks ? 'EXECUTE' : 'WAIT', hasTasks ? 'decision pipeline disabled; allowing execution' : 'decision pipeline disabled; no tasks', { force: true });
      return context.toDecisionResult();
    }

    for (const decision of this.registry.list({ includeDisabled: false })) {
      const started = Date.now();
      context.diagnostics.pipelineOrder.push(decision.id);
      try {
        if (!decision.initialized && typeof decision.initialize === 'function') await decision.initialize();
        if (decision.supports(context)) await decision.decide(context);
        if (context.status === 'REJECT' && this.configuration.shortCircuit !== false) {
          break;
        }
      } catch (error) {
        const wrapped = new PipelineError(`Decision failed: ${decision.id}`, { cause: error, context: { decisionId: decision.id } });
        context.diagnostics.error(wrapped);
        if (this.configuration.strict) throw wrapped;
      } finally {
        context.diagnostics.time(decision.id, Date.now() - started);
        if (typeof decision.cleanup === 'function') await decision.cleanup(context);
      }
    }

    return context.toDecisionResult();
  }
}

class DecisionManager {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof DecisionConfiguration
      ? options.configuration
      : new DecisionConfiguration(options.configuration || options);
    this.registry = options.registry || new DecisionRegistry();
    this.pipeline = options.pipeline || null;
    if (options.defaultDecisions !== false) this._registerDefaults();
  }

  _registerDefaults() {
    [
      [DecisionEngine, 'decision.engine', 10],
      [ExecutionDecision, 'decision.execution', 20],
      [ClarificationDecision, 'decision.clarification', 30],
      [ConfirmationDecision, 'decision.confirmation', 40],
      [PolicyDecision, 'decision.policy', 50],
      [ConflictDecision, 'decision.conflict', 60]
    ].forEach(([Ctor, id, priority]) => {
      const configured = this.configuration.getDecisionOptions(id, { priority });
      this.registry.register(new Ctor({ id, ...configured }), { id, priority: configured.priority, enabled: configured.enabled });
    });
  }

  registerDecision(decision, options = {}) {
    this.registry.register(decision, options);
    return this;
  }

  async decide(executionBlueprint, options = {}) {
    if (!this.pipeline) {
      this.pipeline = new DecisionPipeline({
        registry: this.registry,
        configuration: this.configuration
      });
    }
    return this.pipeline.run(executionBlueprint, {
      ...(options || {}),
      metadata: {
        ...(options.metadata || {}),
        decisionManagerVersion: this.configuration.version
      }
    });
  }

  getStatus() {
    return {
      enabled: this.configuration.enabled,
      version: this.configuration.version,
      pipelineReady: Boolean(this.pipeline),
      decisionCount: this.registry.list().length,
      decisions: this.registry.health()
    };
  }

  destroy() {
    for (const decision of this.registry.list()) decision.destroy?.();
    this.registry.clear();
    this.pipeline = null;
  }
}

function createDefaultDecisionManager(options = {}) {
  return new DecisionManager(options);
}

module.exports = {
  DecisionError,
  ConfigurationError,
  PipelineError,
  DecisionConfiguration,
  DECISION_STATUSES,
  DecisionDiagnostics,
  DecisionLogger,
  DecisionResult,
  DecisionContext,
  DecisionRegistry,
  BaseDecision,
  DecisionEngine,
  ExecutionDecision,
  ClarificationDecision,
  ConfirmationDecision,
  PolicyDecision,
  ConflictDecision,
  DecisionPipeline,
  DecisionManager,
  createDefaultDecisionManager
};