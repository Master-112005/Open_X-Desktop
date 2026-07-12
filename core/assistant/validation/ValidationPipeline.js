'use strict';

const ValidationContext = require('./ValidationContext');
const ValidationConfiguration = require('./ValidationConfiguration');
const ValidationRegistry = require('./ValidationRegistry');
const { PipelineError } = require('./ValidationErrors');

class ValidationPipeline {
  constructor(options = {}) {
    this.registry = options.registry || new ValidationRegistry();
    this.configuration = options.configuration instanceof ValidationConfiguration
      ? options.configuration
      : new ValidationConfiguration(options.configuration || {});
  }

  async run(executionBlueprint, decisionResult, options = {}) {
    const context = new ValidationContext({
      executionBlueprint,
      decisionResult,
      automationEngine: options.automationEngine || null,
      configuration: this.configuration,
      metadata: options.metadata || {}
    });
    if (this.configuration.enabled === false) return context.toValidationResult();

    for (const validator of this.registry.list({ includeDisabled: false })) {
      const started = Date.now();
      context.diagnostics.pipelineOrder.push(validator.id);
      try {
        if (!validator.initialized && typeof validator.initialize === 'function') await validator.initialize();
        if (validator.supports(context)) await validator.validate(context);
      } catch (error) {
        const wrapped = new PipelineError(`Validator failed: ${validator.id}`, { cause: error, context: { validatorId: validator.id } });
        context.diagnostics.error(wrapped);
        if (this.configuration.strict) throw wrapped;
      } finally {
        context.diagnostics.time(validator.id, Date.now() - started);
        if (typeof validator.cleanup === 'function') await validator.cleanup(context);
      }
    }

    return context.toValidationResult();
  }
}

module.exports = ValidationPipeline;
