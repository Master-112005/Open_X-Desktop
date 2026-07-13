'use strict';

const MemoryContext = require('./MemoryContext');
const MemoryConfiguration = require('./MemoryConfiguration');
const MemoryRegistry = require('./MemoryRegistry');
const { withTimeout } = require('../utils/AsyncHelpers');
const { ProviderError, ProviderTimeoutError } = require('./MemoryErrors');

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
      context.diagnostics.order(component.id);
      try {
        if (!component.initialized && typeof component.initialize === 'function') await component.initialize();
        if (typeof component.supports === 'function' && !component.supports(context)) {
          if (typeof component.markRun === 'function') component.markRun({ skipped: true, success: true });
          continue;
        }
        if (component.enabled !== false) await this._runComponent(component, method, context);
        if (typeof component.markRun === 'function') component.markRun({ success: true });
        if (method === 'collect') context.diagnostics.provider(component.id);
        if (references) {
          context.diagnostics.reference(component.id, context.resolvedReferences.length > 0 || context.references.length === 0);
        }
      } catch (error) {
        const wrapped = error instanceof ProviderTimeoutError
          ? error
          : new ProviderError(`Memory component failed: ${component.id}`, { cause: error, context: { componentId: component.id } });
        if (typeof component.markRun === 'function') component.markRun({ success: false });
        context.diagnostics.error(wrapped);
        if (this.configuration.strict) throw wrapped;
      } finally {
        context.diagnostics.time(component.id, Date.now() - started);
      }
    }
  }

  async _runComponent(component, method, context) {
    const configured = this.configuration.getProviderOptions(
      method === 'collect' ? 'contextProviders' : method === 'resolve' ? 'referenceResolvers' : 'memoryProviders',
      component.id,
      {}
    );
    const timeoutMs = Number(component.options?.timeoutMs || this.configuration.providerTimeoutMs || configured.timeoutMs);
    return withTimeout(
      Promise.resolve().then(() => component[method](context)),
      timeoutMs,
      () => new ProviderTimeoutError(`Memory component timed out: ${component.id}`, {
        context: { componentId: component.id, timeoutMs }
      })
    );
  }
}

module.exports = MemoryPipeline;
