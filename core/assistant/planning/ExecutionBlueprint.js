'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

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

module.exports = ExecutionBlueprint;
