'use strict';

const LearningContext = require('./LearningContext');
const LearningConfiguration = require('./LearningConfiguration');
const LearningRegistry = require('./LearningRegistry');
const LearningPolicy = require('./LearningPolicy');
const LearningValidator = require('./LearningValidator');
const LearningStorage = require('./LearningStorage');
const LearningAnalytics = require('./LearningAnalytics');
const { PipelineError } = require('./LearningErrors');

class LearningPipeline {
  constructor(options = {}) {
    this.registry = options.registry || new LearningRegistry();
    this.configuration = options.configuration instanceof LearningConfiguration
      ? options.configuration
      : new LearningConfiguration(options.configuration || {});
    this.policy = options.policy || new LearningPolicy({ minConfidence: this.configuration.minConfidence });
    this.validator = options.validator || new LearningValidator();
    this.storage = options.storage || new LearningStorage({
      ...(this.configuration.storage || {}),
      maxRecords: this.configuration.maxRecords
    });
    this.analytics = options.analytics || new LearningAnalytics();
  }

  async run(assistantResponse, options = {}) {
    const context = new LearningContext({
      assistantResponse,
      configuration: this.configuration,
      policy: this.policy,
      validator: this.validator,
      storage: this.storage,
      metadata: options.metadata || {}
    });
    if (this.configuration.enabled === false) return context.toLearningResult();

    for (const module of this.registry.list({ includeDisabled: false })) {
      const started = Date.now();
      context.diagnostics.pipelineOrder.push(module.id);
      try {
        if (!module.initialized && typeof module.initialize === 'function') await module.initialize();
        if (module.supports(context)) await module.learn(context);
      } catch (error) {
        const wrapped = new PipelineError(`Learning module failed: ${module.id}`, { cause: error, context: { moduleId: module.id } });
        context.diagnostics.error(wrapped);
        if (this.configuration.strict) throw wrapped;
      } finally {
        context.diagnostics.time(module.id, Date.now() - started);
        if (typeof module.cleanup === 'function') await module.cleanup(context);
      }
    }

    const storageResult = this.storage.commit(context.acceptedEvents);
    const analytics = this.analytics.summarize(context, storageResult);
    context.metadata.analytics = analytics;
    context.applyStorageResult(storageResult);
    return context.toLearningResult();
  }
}

module.exports = LearningPipeline;
