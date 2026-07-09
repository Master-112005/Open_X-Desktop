'use strict';

const EntityContext = require('./EntityContext');
const EntityConfiguration = require('./EntityConfiguration');
const EntityRegistry = require('./EntityRegistry');
const EntityNormalizer = require('./EntityNormalizer');
const EntityResolver = require('./EntityResolver');
const EntityValidator = require('./EntityValidator');
const EntityRelationshipBuilder = require('./EntityRelationshipBuilder');
const EntityGraphBuilder = require('./EntityGraphBuilder');
const { ExtractorExecutionError } = require('./EntityErrors');

class EntityPipeline {
  constructor(options = {}) {
    this.registry = options.registry || new EntityRegistry();
    this.configuration = options.configuration instanceof EntityConfiguration
      ? options.configuration
      : new EntityConfiguration(options.configuration || {});
    this.logger = options.logger || null;
    this.steps = options.steps || [
      new EntityNormalizer(options.normalizer || {}),
      new EntityResolver(options.resolver || {}),
      new EntityValidator(options.validator || {}),
      new EntityRelationshipBuilder(options.relationshipBuilder || {}),
      new EntityGraphBuilder(options.graphBuilder || {})
    ];
  }

  async run(semanticRepresentation, options = {}) {
    const context = semanticRepresentation instanceof EntityContext
      ? semanticRepresentation
      : new EntityContext({
          semanticRepresentation,
          configuration: this.configuration,
          metadata: options.metadata || {}
        });
    if (this.configuration.enabled === false) return context.toStructuredEntities();

    for (const extractor of this.registry.listExtractors({ includeDisabled: false })) {
      const started = Date.now();
      context.diagnostics.pipelineOrder.push(extractor.id);
      try {
        if (!extractor.initialized && typeof extractor.initialize === 'function') await extractor.initialize();
        if (extractor.supports(context)) await extractor.extract(context);
        if (typeof extractor.validate === 'function') extractor.validate(context);
      } catch (error) {
        const wrapped = new ExtractorExecutionError(`Entity extractor failed: ${extractor.id}`, { cause: error, context: { extractorId: extractor.id } });
        context.diagnostics.error(wrapped);
        if (this.configuration.strict) throw wrapped;
      } finally {
        context.diagnostics.time(extractor.id, Date.now() - started);
        if (typeof extractor.cleanup === 'function') await extractor.cleanup(context);
      }
    }

    for (const step of this.steps) {
      context.diagnostics.pipelineOrder.push(step.id);
      const started = Date.now();
      try {
        await step.process(context);
      } catch (error) {
        context.diagnostics.error(error, { stepId: step.id });
        if (this.configuration.strict) throw error;
      } finally {
        context.diagnostics.time(step.id, Date.now() - started);
      }
    }

    return context.toStructuredEntities();
  }
}

module.exports = EntityPipeline;
