'use strict';

const ValidationDiagnostics = require('./ValidationDiagnostics');
const ValidationResult = require('./ValidationResult');

class ValidationContext {
  constructor({ executionBlueprint = null, decisionResult = null, automationEngine = null, configuration = null, metadata = {} } = {}) {
    this.executionBlueprint = executionBlueprint || null;
    this.decisionResult = decisionResult || null;
    this.automationEngine = automationEngine || null;
    this.configuration = configuration || null;
    this.metadata = {
      source: metadata.source || metadata.sourceType || 'chat',
      ...(metadata || {})
    };
    this.checks = [];
    this.errors = [];
    this.warnings = [];
    this.diagnostics = new ValidationDiagnostics();
    this.futureExtensions = {};
  }

  check(id, valid, message = '', data = {}) {
    const record = {
      id: String(id || 'validation'),
      valid: valid !== false,
      message: String(message || ''),
      data: { ...(data || {}) },
      timestamp: Date.now()
    };
    this.checks.push(record);
    if (this.configuration?.maxChecks && this.checks.length > this.configuration.maxChecks) {
      this.checks.splice(0, this.checks.length - this.configuration.maxChecks);
    }
    if (!record.valid) this.errors.push(record);
    return record;
  }

  warn(id, message, data = {}) {
    const record = { id: String(id || 'validation'), message: String(message || ''), data: { ...(data || {}) }, timestamp: Date.now() };
    this.warnings.push(record);
    this.diagnostics.warn(message, data);
    return record;
  }

  tasks() {
    return Array.isArray(this.executionBlueprint?.tasks) ? this.executionBlueprint.tasks : [];
  }

  actionCounts() {
    return this.tasks().reduce((counts, task) => {
      const action = String(task.action || 'UNKNOWN');
      counts[action] = (counts[action] || 0) + 1;
      return counts;
    }, {});
  }

  summary() {
    return {
      valid: this.errors.length === 0,
      taskCount: this.tasks().length,
      checkCount: this.checks.length,
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      actionCounts: this.actionCounts()
    };
  }

  toValidationResult() {
    return new ValidationResult({
      valid: this.errors.length === 0,
      checks: this.checks,
      errors: this.errors,
      warnings: this.warnings,
      metadata: this.metadata,
      summary: this.summary(),
      diagnostics: this.diagnostics.toJSON(),
      version: this.configuration?.version || '10.0.0',
      futureExtensions: this.futureExtensions
    });
  }
}

module.exports = ValidationContext;
