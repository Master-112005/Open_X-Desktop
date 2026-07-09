'use strict';

const DEFAULT_PROVIDER_OPTIONS = Object.freeze({
  enabled: true,
  priority: 100,
  ttlMs: 30 * 60 * 1000,
  limit: 50
});

class MemoryConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || '7.0.0');
    this.strict = input.strict === true;
    this.memoryLimit = Number(input.memoryLimit || 50);
    this.workingMemoryTtlMs = Number(input.workingMemoryTtlMs || 30 * 60 * 1000);
    this.contextRefreshMs = Number(input.contextRefreshMs || 1000);
    this.providers = { ...(input.providers || {}) };
    this.memoryProviders = { ...(input.memoryProviders || {}) };
    this.referenceResolvers = { ...(input.referenceResolvers || {}) };
    this.contextProviders = { ...(input.contextProviders || {}) };
    this.aliases = { ...(input.aliases || {}) };
    this.longTermMemory = input.longTermMemory || null;
  }

  getProviderOptions(group, id, defaults = {}) {
    const configured = this[group]?.[String(id || '')] || {};
    return {
      ...DEFAULT_PROVIDER_OPTIONS,
      ...(defaults || {}),
      ...configured
    };
  }
}

module.exports = MemoryConfiguration;
