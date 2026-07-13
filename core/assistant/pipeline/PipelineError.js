'use strict';

class PipelineError extends Error {
  constructor(message, options = {}) {
    super(message || 'Pipeline error.');
    this.name = this.constructor.name;
    this.code = options.code || 'pipeline-error';
    this.stageId = options.stageId || null;
    this.details = options.details || null;
    this.requestId = options.requestId || null;
    if (options.cause) this.cause = options.cause;
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      stageId: this.stageId,
      requestId: this.requestId,
      details: this.details,
      cause: this.cause ? {
        name: this.cause.name || 'Error',
        message: this.cause.message || String(this.cause)
      } : null
    };
  }
}

class StageExecutionError extends PipelineError {
  constructor(message, options = {}) {
    super(message || 'Stage execution failed.', { ...options, code: options.code || 'stage-execution-error' });
  }
}

class ValidationError extends PipelineError {
  constructor(message, options = {}) {
    super(message || 'Pipeline validation failed.', { ...options, code: options.code || 'validation-error' });
  }
}

class ConfigurationError extends PipelineError {
  constructor(message, options = {}) {
    super(message || 'Pipeline configuration error.', { ...options, code: options.code || 'configuration-error' });
  }
}

class TimeoutError extends PipelineError {
  constructor(message, options = {}) {
    super(message || 'Pipeline timed out.', { ...options, code: options.code || 'timeout-error' });
  }
}

class CancellationError extends PipelineError {
  constructor(message, options = {}) {
    super(message || 'Pipeline cancelled.', { ...options, code: options.code || 'cancellation-error' });
  }
}

class StageTimeoutError extends TimeoutError {
  constructor(message, options = {}) {
    super(message || 'Pipeline stage timed out.', { ...options, code: options.code || 'stage-timeout-error' });
  }
}

module.exports = {
  CancellationError,
  ConfigurationError,
  PipelineError,
  StageExecutionError,
  StageTimeoutError,
  TimeoutError,
  ValidationError
};
