'use strict';

class ValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = details.context || null;
    this.diagnostics = details.diagnostics || [];
    this.code = details.code || this.constructor.name;
    if (details.cause) this.cause = details.cause;
  }
}

class PermissionError extends ValidationError {}
class SafetyError extends ValidationError {}
class ConfigurationError extends ValidationError {}
class PipelineError extends ValidationError {}

module.exports = {
  ValidationError,
  PermissionError,
  SafetyError,
  ConfigurationError,
  PipelineError
};
