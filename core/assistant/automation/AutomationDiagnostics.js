'use strict';

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

module.exports = AutomationDiagnostics;
