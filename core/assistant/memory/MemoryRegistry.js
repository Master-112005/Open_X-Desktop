'use strict';

const { ConfigurationError } = require('./MemoryErrors');

function ordered(items, includeDisabled = true) {
  return [...items.values()]
    .filter(item => includeDisabled || item.enabled !== false)
    .sort((left, right) => (Number(left.priority) || 0) - (Number(right.priority) || 0) || String(left.id).localeCompare(String(right.id)));
}

class MemoryRegistry {
  constructor() {
    this.memoryProviders = new Map();
    this.referenceResolvers = new Map();
    this.contextProviders = new Map();
    this.topicProviders = new Map();
  }

  registerMemoryProvider(provider, options = {}) {
    return this._register(this.memoryProviders, provider, 'apply', options);
  }

  registerReferenceResolver(resolver, options = {}) {
    return this._register(this.referenceResolvers, resolver, 'resolve', options);
  }

  registerContextProvider(provider, options = {}) {
    return this._register(this.contextProviders, provider, 'collect', options);
  }

  registerTopicProvider(provider, options = {}) {
    return this._register(this.topicProviders, provider, 'apply', options);
  }

  _register(map, item, method, options = {}) {
    if (!item || typeof item[method] !== 'function') {
      throw new ConfigurationError(`Memory component must provide ${method}(context).`);
    }
    const id = String(options.id || item.id || item.constructor?.name || '').trim();
    if (!id) throw new ConfigurationError('Memory component id is required.');
    if (map.has(id) && options.replace !== true) {
      throw new ConfigurationError(`Memory component already registered: ${id}`);
    }
    item.id = id;
    if (Number.isFinite(options.priority)) item.priority = Number(options.priority);
    if (options.enabled !== undefined) item.enabled = options.enabled !== false;
    map.set(id, item);
    return this;
  }

  registerAll(kind, components = []) {
    const method = {
      memory: this.registerMemoryProvider.bind(this),
      reference: this.registerReferenceResolver.bind(this),
      context: this.registerContextProvider.bind(this),
      topic: this.registerTopicProvider.bind(this)
    }[String(kind || '')];
    if (!method) throw new ConfigurationError(`Unknown memory registry group: ${kind}`);
    components.forEach(item => {
      if (Array.isArray(item)) method(item[0], item[1] || {});
      else method(item);
    });
    return this;
  }

  listMemoryProviders(options = {}) { return ordered(this.memoryProviders, options.includeDisabled !== false); }
  listReferenceResolvers(options = {}) { return ordered(this.referenceResolvers, options.includeDisabled !== false); }
  listContextProviders(options = {}) { return ordered(this.contextProviders, options.includeDisabled !== false); }
  listTopicProviders(options = {}) { return ordered(this.topicProviders, options.includeDisabled !== false); }

  health() {
    const serialize = item => (typeof item.describe === 'function'
      ? item.describe()
      : {
        id: item.id,
        version: item.version,
        priority: item.priority,
        enabled: item.enabled !== false,
        initialized: item.initialized === true
      });
    return {
      memoryProviders: this.listMemoryProviders().map(serialize),
      referenceResolvers: this.listReferenceResolvers().map(serialize),
      contextProviders: this.listContextProviders().map(serialize),
      topicProviders: this.listTopicProviders().map(serialize)
    };
  }

  counts() {
    return {
      memoryProviders: this.memoryProviders.size,
      referenceResolvers: this.referenceResolvers.size,
      contextProviders: this.contextProviders.size,
      topicProviders: this.topicProviders.size
    };
  }

  clear() {
    const count = this.counts();
    this.memoryProviders.clear();
    this.referenceResolvers.clear();
    this.contextProviders.clear();
    this.topicProviders.clear();
    return count;
  }
}

module.exports = MemoryRegistry;
