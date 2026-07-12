'use strict';

class ReasoningError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = details.context || null;
    this.diagnostics = details.diagnostics || [];
    this.code = details.code || this.constructor.name;
    if (details.cause) this.cause = details.cause;
  }
}

class InferenceError extends ReasoningError {}
class GoalReasoningError extends ReasoningError {}
class IntentReasoningError extends ReasoningError {}
class ActionReasoningError extends ReasoningError {}
class ConflictError extends ReasoningError {}
class ClarificationError extends ReasoningError {}
class ConfigurationError extends ReasoningError {}
class PipelineError extends ReasoningError {}

module.exports = {
  ReasoningError,
  InferenceError,
  GoalReasoningError,
  IntentReasoningError,
  ActionReasoningError,
  ConflictError,
  ClarificationError,
  ConfigurationError,
  PipelineError
};
