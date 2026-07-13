'use strict';

class MemoryError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = details.context || null;
    this.diagnostics = details.diagnostics || [];
    this.code = details.code || this.constructor.name;
    if (details.cause) this.cause = details.cause;
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      diagnostics: this.diagnostics,
      cause: this.cause ? {
        name: this.cause.name || 'Error',
        message: this.cause.message || String(this.cause)
      } : null
    };
  }
}

class ReferenceResolutionError extends MemoryError {}
class ContextError extends MemoryError {}
class ProviderError extends MemoryError {}
class ConfigurationError extends MemoryError {}
class PipelineError extends MemoryError {}
class ProviderTimeoutError extends ProviderError {}

module.exports = {
  MemoryError,
  ReferenceResolutionError,
  ContextError,
  ProviderError,
  ProviderTimeoutError,
  ConfigurationError,
  PipelineError
};
