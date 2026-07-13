'use strict';

const DecisionContext = require('./DecisionContext');
const DecisionConfiguration = require('./DecisionConfiguration');
const DecisionRegistry = require('./DecisionRegistry');
const { PipelineError } = require('./DecisionErrors');

class DecisionPipeline {
  constructor(options = {}) {
    this.registry = options.registry || new DecisionRegistry();
    this.configuration = options.configuration instanceof DecisionConfiguration
      ? options.configuration
      : new DecisionConfiguration(options.configuration || {});
  }

  async run(executionBlueprint, options = {}) {
    const context = new DecisionContext({
      executionBlueprint,
      configuration: this.configuration,
      metadata: options.metadata || {}
    });
    if (this.configuration.enabled === false) {
      const hasTasks = Array.isArray(executionBlueprint?.tasks) && executionBlueprint.tasks.length > 0;
      context.setStatus(hasTasks ? 'EXECUTE' : 'WAIT', hasTasks ? 'decision pipeline disabled; allowing execution' : 'decision pipeline disabled; no tasks', { force: true });
      return context.toDecisionResult();
    }

    for (const decision of this.registry.list({ includeDisabled: false })) {
      const started = Date.now();
      context.diagnostics.pipelineOrder.push(decision.id);
      try {
        if (!decision.initialized && typeof decision.initialize === 'function') await decision.initialize();
        if (decision.supports(context)) await decision.decide(context);
        if (context.status === 'REJECT' && this.configuration.shortCircuit !== false) {
          break;
        }
      } catch (error) {
        const wrapped = new PipelineError(`Decision failed: ${decision.id}`, { cause: error, context: { decisionId: decision.id } });
        context.diagnostics.error(wrapped);
        if (this.configuration.strict) throw wrapped;
      } finally {
        context.diagnostics.time(decision.id, Date.now() - started);
        if (typeof decision.cleanup === 'function') await decision.cleanup(context);
      }
    }

    return context.toDecisionResult();
  }
}

module.exports = DecisionPipeline;
