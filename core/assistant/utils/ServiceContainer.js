'use strict';

class ServiceContainer {
  constructor(parent = null) {
    this.parent = parent;
    this.factories = new Map();
    this.instances = new Map();
    this.resolving = new Set();
  }

  register(name, factoryOrValue) {
    const key = String(name || '').trim();
    if (!key) throw new Error('Service name is required.');
    this.factories.set(key, factoryOrValue);
    this.instances.delete(key);
    return this;
  }

  has(name) {
    const key = String(name || '').trim();
    return this.factories.has(key) || this.instances.has(key) || Boolean(this.parent?.has?.(key));
  }

  resolve(name) {
    const key = String(name || '').trim();
    if (this.instances.has(key)) return this.instances.get(key);
    if (this.factories.has(key)) {
      if (this.resolving.has(key)) {
        throw new Error(`Circular service dependency: ${key}`);
      }
      const factory = this.factories.get(key);
      this.resolving.add(key);
      try {
        const instance = typeof factory === 'function' ? factory(this) : factory;
        this.instances.set(key, instance);
        return instance;
      } finally {
        this.resolving.delete(key);
      }
    }
    if (this.parent?.resolve) return this.parent.resolve(key);
    return undefined;
  }

  unregister(name) {
    const key = String(name || '').trim();
    this.factories.delete(key);
    this.instances.delete(key);
    return this;
  }

  clear() {
    this.factories.clear();
    this.instances.clear();
    this.resolving.clear();
    return this;
  }

  createScope() {
    return new ServiceContainer(this);
  }
}

module.exports = ServiceContainer;
