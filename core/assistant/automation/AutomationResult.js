'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

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

module.exports = AutomationResult;
