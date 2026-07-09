'use strict';

const ValidationDiagnostics = require('./ValidationDiagnostics');
const ValidationResult = require('./ValidationResult');

class ValidationContext {
  constructor({ executionBlueprint = null, decisionResult = null, automationEngine = null, configuration = null, metadata = {} } = {}) {
    this.executionBlueprint = executionBlueprint || null;
    this.decisionResult = decisionResult || null;
    this.automationEngine = automationEngine || null;
    this.configuration = configuration || null;
    this.metadata = { ...(metadata || {}) };
    this.checks = [];
    this.errors = [];
    this.warnings = [];
    this.diagnostics = new ValidationDiagnostics();
    this.futureExtensions = {};
  }

  check(id, valid, message = '', data = {}) {
    const record = { id, valid: valid !== false, message, data };
    this.checks.push(record);
    if (!record.valid) this.errors.push(record);
    return record;
  }

  warn(id, message, data = {}) {
    const record = { id, message, data };
    this.warnings.push(record);
    this.diagnostics.warn(message, data);
    return record;
  }

  toValidationResult() {
    return new ValidationResult({
      valid: this.errors.length === 0,
      checks: this.checks,
      errors: this.errors,
      warnings: this.warnings,
      metadata: this.metadata,
      diagnostics: this.diagnostics.toJSON(),
      version: this.configuration?.version || '10.0.0',
      futureExtensions: this.futureExtensions
    });
  }
}

module.exports = ValidationContext;
