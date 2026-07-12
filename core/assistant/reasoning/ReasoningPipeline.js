'use strict';

const ReasoningContext = require('./ReasoningContext');
const ReasoningConfiguration = require('./ReasoningConfiguration');
const ReasoningRegistry = require('./ReasoningRegistry');
const { PipelineError } = require('./ReasoningErrors');

class ReasoningPipeline {
  constructor(options = {}) {
    this.registry = options.registry || new ReasoningRegistry();
    this.configuration = options.configuration instanceof ReasoningConfiguration
      ? options.configuration
      : new ReasoningConfiguration(options.configuration || {});
    this.logger = options.logger || null;
  }

  async run(resolvedContext, options = {}) {
    const context = new ReasoningContext({
      resolvedContext,
      configuration: this.configuration,
      metadata: options.metadata || {}
    });
    if (this.configuration.enabled === false) return context.toReasoningResult();

    for (const reasoner of this.registry.list({ includeDisabled: false })) {
      const started = Date.now();
      context.diagnostics.pipelineOrder.push(reasoner.id);
      try {
        if (!reasoner.initialized && typeof reasoner.initialize === 'function') await reasoner.initialize();
        if (reasoner.supports(context)) await reasoner.reason(context);
      } catch (error) {
        const wrapped = new PipelineError(`Reasoner failed: ${reasoner.id}`, { cause: error, context: { reasonerId: reasoner.id } });
        context.diagnostics.error(wrapped);
        if (this.configuration.strict) throw wrapped;
      } finally {
        context.diagnostics.time(reasoner.id, Date.now() - started);
        if (typeof reasoner.cleanup === 'function') await reasoner.cleanup(context);
      }
    }

    return context.toReasoningResult();
  }
}

module.exports = ReasoningPipeline;
