'use strict';

const ResponseContext = require('./ResponseContext');
const ResponseConfiguration = require('./ResponseConfiguration');
const ResponseRegistry = require('./ResponseRegistry');
const { PipelineError } = require('./ResponseErrors');

class ResponsePipeline {
  constructor(options = {}) {
    this.registry = options.registry || new ResponseRegistry();
    this.configuration = options.configuration instanceof ResponseConfiguration
      ? options.configuration
      : new ResponseConfiguration(options.configuration || {});
  }

  async run(verificationResult, options = {}) {
    const context = new ResponseContext({
      verificationResult,
      configuration: this.configuration,
      metadata: options.metadata || {}
    });
    if (this.configuration.enabled === false) return context.toAssistantResponse();

    for (const generator of this.registry.list({ includeDisabled: false })) {
      const started = Date.now();
      context.diagnostics.pipelineOrder.push(generator.id);
      try {
        if (!generator.initialized && typeof generator.initialize === 'function') await generator.initialize();
        if (generator.supports(context)) await generator.generate(context);
      } catch (error) {
        const wrapped = new PipelineError(`Response generator failed: ${generator.id}`, { cause: error, context: { generatorId: generator.id } });
        context.diagnostics.error(wrapped);
        if (this.configuration.strict) throw wrapped;
      } finally {
        context.diagnostics.time(generator.id, Date.now() - started);
        if (typeof generator.cleanup === 'function') await generator.cleanup(context);
      }
    }

    return context.toAssistantResponse();
  }
}

module.exports = ResponsePipeline;
