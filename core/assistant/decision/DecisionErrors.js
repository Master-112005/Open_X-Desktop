'use strict';

class DecisionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = details.context || null;
    this.diagnostics = details.diagnostics || [];
    this.code = details.code || this.constructor.name;
    if (details.cause) this.cause = details.cause;
  }
}

class ConfigurationError extends DecisionError {}
class PipelineError extends DecisionError {}

module.exports = { DecisionError, ConfigurationError, PipelineError };
