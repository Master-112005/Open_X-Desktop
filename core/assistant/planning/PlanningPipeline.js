'use strict';

const PlanningContext = require('./PlanningContext');
const PlanningConfiguration = require('./PlanningConfiguration');
const PlanningRegistry = require('./PlanningRegistry');
const { PlannerExecutionError } = require('./PlanningErrors');

class PlanningPipeline {
  constructor(options = {}) {
    this.registry = options.registry || new PlanningRegistry();
    this.configuration = options.configuration instanceof PlanningConfiguration
      ? options.configuration
      : new PlanningConfiguration(options.configuration || {});
    this.logger = options.logger || null;
  }

  async run(reasoningResult, options = {}) {
    const context = new PlanningContext({
      reasoningResult,
      configuration: this.configuration,
      metadata: options.metadata || {}
    });
    if (this.configuration.enabled === false) {
      context.diagnostics.warn('Planning pipeline disabled; returning empty execution blueprint.');
      return context.toExecutionBlueprint();
    }

    for (const planner of this.registry.list({ includeDisabled: false })) {
      const started = Date.now();
      context.diagnostics.pipelineOrder.push(planner.id);
      try {
        if (!planner.initialized && typeof planner.initialize === 'function') await planner.initialize();
        if (planner.supports(context)) await planner.plan(context);
        context.removeInvalidReferences();
      } catch (error) {
        const wrapped = new PlannerExecutionError(`Planner failed: ${planner.id}`, { cause: error, context: { plannerId: planner.id } });
        context.diagnostics.error(wrapped);
        if (this.configuration.strict) throw wrapped;
      } finally {
        context.diagnostics.time(planner.id, Date.now() - started);
        if (typeof planner.cleanup === 'function') await planner.cleanup(context);
      }
    }

    return context.toExecutionBlueprint();
  }
}

module.exports = PlanningPipeline;
