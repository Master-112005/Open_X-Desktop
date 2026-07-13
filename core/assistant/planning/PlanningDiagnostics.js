'use strict';

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

module.exports = PlanningDiagnostics;
