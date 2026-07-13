'use strict';

class ResponseGenerationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = details.context || null;
    this.diagnostics = details.diagnostics || [];
    this.code = details.code || this.constructor.name;
    if (details.cause) this.cause = details.cause;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      diagnostics: this.diagnostics,
      cause: this.cause ? { name: this.cause.name, message: this.cause.message, code: this.cause.code || null } : null
    };
  }
}

class FormattingError extends ResponseGenerationError {}
class ConfigurationError extends ResponseGenerationError {}
class PipelineError extends ResponseGenerationError {}

module.exports = { ResponseGenerationError, FormattingError, ConfigurationError, PipelineError };
