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

  addTask(task = {}) {
    const id = String(task.id || `task.${this.tasks.length + 1}`);
    const existing = this.tasks.find(item => item.id === id);
    if (existing) return existing;
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
      metadata: { ...(task.metadata || {}) }
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

  toExecutionBlueprint() {
    this.timing.finishedAt = this.timing.finishedAt || Date.now();
    this.timing.durationMs = Math.max(0, this.timing.finishedAt - this.timing.startedAt);
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
      version: this.configuration?.version || '9.0.0',
      futureExtensions: this.futureExtensions
    });
  }
}

module.exports = PlanningContext;
