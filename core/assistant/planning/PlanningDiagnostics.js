'use strict';

class PlanningDiagnostics {
  constructor() {
    this.planningTime = {};
    this.taskCount = 0;
    this.workflowCount = 0;
    this.dependencyCount = 0;
    this.optimizationResults = [];
    this.parallelGroups = 0;
    this.recoveryPlans = 0;
    this.warnings = [];
    this.errors = [];
    this.pipelineOrder = [];
    this.memoryUsage = this._memoryUsage();
  }

  time(id, durationMs) {
    this.planningTime[String(id || '')] = Math.max(0, Number(durationMs) || 0);
  }

  warn(message, data = {}) {
    this.warnings.push({ message: String(message || ''), data, timestamp: Date.now() });
  }

  error(error, data = {}) {
    this.errors.push({
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
      planningTime: { ...this.planningTime },
      taskCount: this.taskCount,
      workflowCount: this.workflowCount,
      dependencyCount: this.dependencyCount,
      optimizationResults: this.optimizationResults.slice(),
      parallelGroups: this.parallelGroups,
      recoveryPlans: this.recoveryPlans,
      warnings: this.warnings.slice(),
      errors: this.errors.slice(),
      pipelineOrder: this.pipelineOrder.slice(),
      memoryUsage: this.memoryUsage
    };
  }
}

module.exports = PlanningDiagnostics;
