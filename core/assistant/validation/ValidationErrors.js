'use strict';

class ValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = details.context || null;
    this.diagnostics = details.diagnostics || [];
    this.code = details.code || this.constructor.name;
    this.timestamp = Date.now();
    if (details.cause) this.cause = details.cause;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      diagnostics: this.diagnostics,
      timestamp: this.timestamp
    };
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
