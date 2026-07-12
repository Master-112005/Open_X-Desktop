'use strict';

class EntityError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = details.context || null;
    this.diagnostics = details.diagnostics || [];
    this.code = details.code || this.constructor.name;
    if (details.cause) this.cause = details.cause;
  }
}

class EntityExtractionError extends EntityError {}
class EntityResolutionError extends EntityError {}
class EntityValidationError extends EntityError {}
class EntityGraphError extends EntityError {}
class ConfigurationError extends EntityError {}
class ExtractorExecutionError extends EntityError {}

module.exports = {
  EntityError,
  EntityExtractionError,
  EntityResolutionError,
  EntityValidationError,
  EntityGraphError,
  ConfigurationError,
  ExtractorExecutionError
};
