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

async function runProcessor(processor, context) {
  if (typeof processor === 'function') return processor(context);
  if (processor && typeof processor.process === 'function') return processor.process(context);
  if (processor && typeof processor.normalize === 'function') {
    for (const entity of context.allEntities()) processor.normalize(entity, context);
    return context;
  }
  if (processor && typeof processor.resolve === 'function') {
    for (const entity of context.allEntities()) processor.resolve(entity, context);
    return context;
  }
  if (processor && typeof processor.validate === 'function') {
    for (const entity of context.allEntities()) processor.validate(entity, context);
    return context;
  }
  return context;
}

class EntityPipeline {
  constructor(options = {}) {
    this.registry = options.registry || new EntityRegistry();
    this.configuration = options.configuration instanceof EntityConfiguration
      ? options.configuration
      : new EntityConfiguration(options.configuration || {});
    this.logger = options.logger || null;
    this.steps = options.steps || [
      new EntityNormalizer({ ...(options.normalizer || {}), maps: this.configuration.dictionaries }),
      new EntityResolver({ ...(options.resolver || {}), providers: this.configuration.providers }),
      new EntityValidator({ ...(options.validator || {}), providers: this.configuration.providers }),
      new EntityRelationshipBuilder(options.relationshipBuilder || {}),
      new EntityGraphBuilder(options.graphBuilder || {})
    ];
  }

  async _runRegistered(kind, context) {
    const processors = [...(this.registry[kind]?.entries?.() || [])];
    for (const [id, processor] of processors) {
      const started = Date.now();
      context.diagnostics.pipelineOrder.push(id);
      try {
        await runProcessor(processor, context);
      } catch (error) {
        context.diagnostics.error(error, { stepId: id });
        if (this.configuration.strict) throw error;
      } finally {
        context.diagnostics.time(id, Date.now() - started);
      }
    }
  }

  async run(semanticRepresentation, options = {}) {
    const context = semanticRepresentation instanceof EntityContext
      ? semanticRepresentation
      : new EntityContext({
          semanticRepresentation,
          configuration: this.configuration,
          registry: this.registry,
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
        if (step instanceof EntityNormalizer) await this._runRegistered('normalizers', context);
        if (step instanceof EntityResolver) await this._runRegistered('resolvers', context);
        if (step instanceof EntityValidator) await this._runRegistered('validators', context);
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
