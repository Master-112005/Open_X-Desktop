'use strict';

class PlanningError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = details.context || null;
    this.diagnostics = details.diagnostics || [];
    this.code = details.code || this.constructor.name;
    if (details.cause) this.cause = details.cause;
  }
}

class WorkflowPlanningError extends PlanningError {}
class DependencyError extends PlanningError {}
class OptimizationError extends PlanningError {}
class ExecutionBlueprintError extends PlanningError {}
class ConfigurationError extends PlanningError {}
class PlannerExecutionError extends PlanningError {}

module.exports = {
  PlanningError,
  WorkflowPlanningError,
  DependencyError,
  OptimizationError,
  ExecutionBlueprintError,
  ConfigurationError,
  PlannerExecutionError
};
