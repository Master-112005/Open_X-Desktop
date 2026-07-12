'use strict';

class LearningError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = details.context || null;
    this.diagnostics = details.diagnostics || [];
    this.code = details.code || this.constructor.name;
    if (details.cause) this.cause = details.cause;
  }
}

class LearningPolicyError extends LearningError {}
class LearningValidationError extends LearningError {}
class LearningStorageError extends LearningError {}
class ConfigurationError extends LearningError {}
class PipelineError extends LearningError {}

module.exports = {
  LearningError,
  LearningPolicyError,
  LearningValidationError,
  LearningStorageError,
  ConfigurationError,
  PipelineError
};
