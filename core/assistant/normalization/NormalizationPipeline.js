'use strict';

const NormalizationDiagnostics = require('./NormalizationDiagnostics');
const NormalizationLogger = require('./NormalizationLogger');
const { NormalizerExecutionError } = require('./NormalizationErrors');

class NormalizationPipeline {
  constructor({ registry, configuration, diagnostics = null, logger = null } = {}) {
    this.registry = registry;
    this.configuration = configuration;
    this.diagnostics = diagnostics || new NormalizationDiagnostics();
    this.logger = logger instanceof NormalizationLogger ? logger : new NormalizationLogger(logger);
  }

  async run(context) {
    if (!this.configuration.enabled) {
      return context;
    }

    const normalizers = this.registry.list({ includeDisabled: false });
    for (const normalizer of normalizers) {
      const startedAt = Date.now();
      try {
        if (!this.configuration.isEnabled(normalizer.id)) continue;
        if (!normalizer.initialized && typeof normalizer.initialize === 'function') {
          await normalizer.initialize();
        }
        if (typeof normalizer.supports === 'function' && !normalizer.supports(context)) {
          continue;
        }
        if (typeof normalizer.validate === 'function') {
          await normalizer.validate(context);
        }
        const nextContext = await normalizer.normalize(context);
        if (nextContext) context = nextContext;
        context.recordTiming(normalizer.id, Date.now() - startedAt, true);
      } catch (error) {
        const wrapped = error instanceof NormalizerExecutionError
          ? error
          : new NormalizerExecutionError(error.message || 'Normalizer failed.', { normalizerId: normalizer.id, cause: error });
        context.recordTiming(normalizer.id, Date.now() - startedAt, false);
        context.addWarning('Normalizer failed; continuing with current text.', { normalizerId: normalizer.id });
        context.addDiagnostic({ level: 'warn', message: wrapped.message, normalizerId: normalizer.id });
        this.diagnostics.record({ level: 'warn', message: wrapped.message, normalizerId: normalizer.id });
        if (this.configuration.strict) throw wrapped;
      } finally {
        if (typeof normalizer.cleanup === 'function') {
          await normalizer.cleanup(context);
        }
      }
    }
    return context;
  }
}

module.exports = NormalizationPipeline;
