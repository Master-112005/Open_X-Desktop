'use strict';

const VerificationContext = require('./VerificationContext');
const VerificationConfiguration = require('./VerificationConfiguration');
const VerificationRegistry = require('./VerificationRegistry');
const VerificationLogger = require('./VerificationLogger');
const { PipelineError } = require('./VerificationErrors');

class VerificationPipeline {
  constructor(options = {}) {
    this.registry = options.registry || new VerificationRegistry();
    this.configuration = options.configuration instanceof VerificationConfiguration
      ? options.configuration
      : new VerificationConfiguration(options.configuration || {});
    this.logger = options.logger instanceof VerificationLogger ? options.logger : new VerificationLogger(options.logger || null);
  }

  async run(automationResult, options = {}) {
    const context = new VerificationContext({
      automationResult,
      configuration: this.configuration,
      metadata: options.metadata || {}
    });
    if (this.configuration.enabled === false) return context.toVerificationResult();

    for (const verifier of this.registry.list({ includeDisabled: false })) {
      const started = Date.now();
      context.diagnostics.pipelineOrder.push(verifier.id);
      try {
        if (!verifier.initialized && typeof verifier.initialize === 'function') await verifier.initialize();
        if (verifier.supports(context)) await verifier.verify(context);
      } catch (error) {
        const wrapped = new PipelineError(`Verifier failed: ${verifier.id}`, { cause: error, context: { verifierId: verifier.id } });
        context.diagnostics.error(wrapped);
        context.addEvidence('verifier-error', wrapped.message, { verifierId: verifier.id }, {
          status: 'failed',
          confidence: 0.1,
          source: verifier.id
        });
        this.logger.warn(wrapped.message, { verifierId: verifier.id });
        if (this.configuration.strict) throw wrapped;
      } finally {
        context.diagnostics.time(verifier.id, Date.now() - started);
        if (typeof verifier.cleanup === 'function') await verifier.cleanup(context);
      }
    }

    return context.toVerificationResult();
  }
}

module.exports = VerificationPipeline;
