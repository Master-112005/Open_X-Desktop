'use strict';

class AutomationDispatchError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = details.context || null;
    this.diagnostics = details.diagnostics || [];
    this.code = details.code || this.constructor.name;
    if (details.cause) this.cause = details.cause;
  }
}

class AutomationExecutionError extends AutomationDispatchError {}
class ConfigurationError extends AutomationDispatchError {}
class PipelineError extends AutomationDispatchError {}

module.exports = {
  AutomationDispatchError,
  AutomationExecutionError,
  ConfigurationError,
  PipelineError
};
