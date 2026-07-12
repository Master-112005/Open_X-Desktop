'use strict';

class VerificationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = details.context || null;
    this.diagnostics = details.diagnostics || [];
    this.code = details.code || this.constructor.name;
    if (details.cause) this.cause = details.cause;
  }
}

class ConfigurationError extends VerificationError {}
class PipelineError extends VerificationError {}

module.exports = { VerificationError, ConfigurationError, PipelineError };
