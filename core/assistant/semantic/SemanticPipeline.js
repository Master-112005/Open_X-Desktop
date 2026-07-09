'use strict';

const SemanticDiagnostics = require('./SemanticDiagnostics');
const SemanticLogger = require('./SemanticLogger');
const { AnalyzerExecutionError } = require('./SemanticErrors');

class SemanticPipeline {
  constructor({ registry, configuration, diagnostics = null, logger = null } = {}) {
    this.registry = registry;
    this.configuration = configuration;
    this.diagnostics = diagnostics || new SemanticDiagnostics();
    this.logger = logger instanceof SemanticLogger ? logger : new SemanticLogger(logger);
  }

  async run(context) {
    if (!this.configuration.enabled) return context;
    const analyzers = this.registry.list({ includeDisabled: false });
    for (const analyzer of analyzers) {
      const startedAt = Date.now();
      try {
        if (!this.configuration.isEnabled(analyzer.id)) continue;
        if (!analyzer.initialized && typeof analyzer.initialize === 'function') await analyzer.initialize();
        if (typeof analyzer.supports === 'function' && !analyzer.supports(context)) continue;
        if (typeof analyzer.validate === 'function') await analyzer.validate(context);
        const nextContext = await analyzer.analyze(context);
        if (nextContext) context = nextContext;
        context.recordTiming(analyzer.id, Date.now() - startedAt, true);
      } catch (error) {
        const wrapped = error instanceof AnalyzerExecutionError
          ? error
          : new AnalyzerExecutionError(error.message || 'Semantic analyzer failed.', { analyzerId: analyzer.id, cause: error });
        context.recordTiming(analyzer.id, Date.now() - startedAt, false);
        context.addWarning('Semantic analyzer failed; continuing with current representation.', { analyzerId: analyzer.id });
        context.addDiagnostic({ level: 'warn', message: wrapped.message, analyzerId: analyzer.id });
        this.diagnostics.record({ level: 'warn', message: wrapped.message, analyzerId: analyzer.id });
        if (this.configuration.strict) throw wrapped;
      } finally {
        if (typeof analyzer.cleanup === 'function') await analyzer.cleanup(context);
      }
    }
    return context;
  }
}

module.exports = SemanticPipeline;
