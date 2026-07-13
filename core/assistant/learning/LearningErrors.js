'use strict';

class LearningError extends Error {
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
      code: this.code,
      message: this.message,
      context: this.context
    };
  }
}

class LearningPolicyError extends LearningError {}
class LearningValidationError extends LearningError {}
class LearningStorageError extends LearningError {}
class ConfigurationError extends LearningError {}
class PipelineError extends LearningError {}
class ModuleTimeoutError extends LearningError {
  constructor(moduleId, timeoutMs) {
    super(`Learning module timed out: ${moduleId}`, {
      code: 'module_timeout',
      context: { moduleId, timeoutMs }
    });
  }
}

module.exports = {
  LearningError,
  LearningPolicyError,
  LearningValidationError,
  LearningStorageError,
  ConfigurationError,
  PipelineError,
  ModuleTimeoutError
};
