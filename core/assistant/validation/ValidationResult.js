'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

class ValidationResult {
  constructor(input = {}) {
    this.valid = input.valid !== false;
    this.checks = Array.isArray(input.checks) ? input.checks.slice() : [];
    this.errors = Array.isArray(input.errors) ? input.errors.slice() : [];
    this.warnings = Array.isArray(input.warnings) ? input.warnings.slice() : [];
    this.metadata = { ...(input.metadata || {}) };
    this.summary = { ...(input.summary || {}) };
    this.diagnostics = input.diagnostics || {};
    this.version = String(input.version || '10.0.0');
    this.futureExtensions = { ...(input.futureExtensions || {}) };
    deepFreeze(this);
  }
}

module.exports = ValidationResult;
