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
        context.compact();
        this._trimCandidates(context);
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

  _trimCandidates(context) {
    const limit = context.configuration?.maxCandidates || 25;
    for (const listName of ['candidateGoals', 'candidateIntents', 'candidateActions', 'candidateTasks']) {
      if (context[listName].length > limit) context[listName] = context.ranked(listName).slice(0, limit);
    }
  }
}

module.exports = ReasoningPipeline;
