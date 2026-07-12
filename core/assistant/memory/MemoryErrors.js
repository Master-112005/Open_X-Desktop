'use strict';

class MemoryError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = details.context || null;
    this.diagnostics = details.diagnostics || [];
    this.code = details.code || this.constructor.name;
    if (details.cause) this.cause = details.cause;
  }
}

class ReferenceResolutionError extends MemoryError {}
class ContextError extends MemoryError {}
class ProviderError extends MemoryError {}
class ConfigurationError extends MemoryError {}
class PipelineError extends MemoryError {}

module.exports = {
  MemoryError,
  ReferenceResolutionError,
  ContextError,
  ProviderError,
  ConfigurationError,
  PipelineError
};
