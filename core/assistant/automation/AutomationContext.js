'use strict';

const AutomationDiagnostics = require('./AutomationDiagnostics');
const AutomationResult = require('./AutomationResult');
const AutomationExecutionGraph = require('./AutomationExecutionGraph');

class AutomationContext {
  constructor({ executionBlueprint = null, decisionResult = null, validationResult = null, automationEngine = null, configuration = {}, metadata = {} } = {}) {
    this.executionBlueprint = executionBlueprint || null;
    this.decisionResult = decisionResult || null;
    this.validationResult = validationResult || null;
    this.automationEngine = automationEngine || null;
    this.configuration = { ...(configuration || {}) };
    this.metadata = { ...(metadata || {}) };
    this.completedActions = [];
    this.failedActions = [];
    this.skippedActions = [];
    this.controllerResults = [];
    this.errors = [];
    this.warnings = [];
    this.diagnostics = new AutomationDiagnostics();
    this.timing = { startedAt: Date.now(), finishedAt: null, durationMs: 0 };
    this.executionStatus = 'NOT_DISPATCHED';
    this.graphBuilder = new AutomationExecutionGraph();
  }

  toAutomationResult() {
    this.timing.finishedAt = this.timing.finishedAt || Date.now();
    this.timing.durationMs = Math.max(0, this.timing.finishedAt - this.timing.startedAt);
    const graph = this.graphBuilder.build(this.executionBlueprint, this.controllerResults);
    this.diagnostics.executionGraph = graph;
    return new AutomationResult({
      decision: this.decisionResult,
      validation: this.validationResult,
      executionStatus: this.executionStatus,
      completedActions: this.completedActions,
      failedActions: this.failedActions,
      skippedActions: this.skippedActions,
      controllerResults: this.controllerResults,
      executionGraph: graph,
      timing: this.timing,
      diagnostics: this.diagnostics.toJSON(),
      errors: this.errors,
      warnings: this.warnings,
      metadata: this.metadata,
      version: this.configuration.version || '10.0.0'
    });
  }
}

module.exports = AutomationContext;
