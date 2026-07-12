'use strict';

const MemoryContext = require('./MemoryContext');
const MemoryConfiguration = require('./MemoryConfiguration');
const MemoryRegistry = require('./MemoryRegistry');
const { ProviderError } = require('./MemoryErrors');

class MemoryPipeline {
  constructor(options = {}) {
    this.registry = options.registry || new MemoryRegistry();
    this.configuration = options.configuration instanceof MemoryConfiguration
      ? options.configuration
      : new MemoryConfiguration(options.configuration || {});
    this.state = options.state || {};
    this.logger = options.logger || null;
  }

  async run(structuredEntities, options = {}) {
    const context = new MemoryContext({
      structuredEntities,
      configuration: this.configuration,
      state: this.state,
      metadata: options.metadata || {},
      snapshots: options.snapshots || {}
    });
    if (this.configuration.enabled === false) return context.toResolvedContext();

    await this._runGroup(context, this.registry.listMemoryProviders({ includeDisabled: false }), 'apply');
    await this._runGroup(context, this.registry.listReferenceResolvers({ includeDisabled: false }), 'resolve', true);
    await this._runGroup(context, this.registry.listContextProviders({ includeDisabled: false }), 'collect');

    return context.toResolvedContext();
  }

  async _runGroup(context, components, method, references = false) {
    for (const component of components) {
      const started = Date.now();
      context.diagnostics.pipelineOrder.push(component.id);
      try {
        if (!component.initialized && typeof component.initialize === 'function') await component.initialize();
        if (component.enabled !== false) await component[method](context);
        if (method === 'collect') context.diagnostics.provider(component.id);
        if (references) {
          context.diagnostics.reference(component.id, context.resolvedReferences.length > 0 || context.references.length === 0);
        }
      } catch (error) {
        const wrapped = new ProviderError(`Memory component failed: ${component.id}`, { cause: error, context: { componentId: component.id } });
        context.diagnostics.error(wrapped);
        if (this.configuration.strict) throw wrapped;
      } finally {
        context.diagnostics.time(component.id, Date.now() - started);
      }
    }
  }
}

module.exports = MemoryPipeline;
