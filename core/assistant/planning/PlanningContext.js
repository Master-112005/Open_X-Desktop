'use strict';

const PlanningDiagnostics = require('./PlanningDiagnostics');
const ExecutionBlueprint = require('./ExecutionBlueprint');

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

module.exports = PlanningContext;
