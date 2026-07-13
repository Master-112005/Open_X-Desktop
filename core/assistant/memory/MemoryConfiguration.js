'use strict';

const DEFAULT_PROVIDER_OPTIONS = Object.freeze({
  enabled: true,
  priority: 100,
  ttlMs: 30 * 60 * 1000,
  limit: 50,
  timeoutMs: 250
});

class MemoryConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || '7.0.0');
    this.strict = input.strict === true;
    this.memoryLimit = Math.max(5, Number(input.memoryLimit || 50));
    this.workingMemoryTtlMs = Math.max(1000, Number(input.workingMemoryTtlMs || 30 * 60 * 1000));
    this.contextRefreshMs = Math.max(100, Number(input.contextRefreshMs || 1000));
    this.providerTimeoutMs = Math.max(10, Number(input.providerTimeoutMs || 250));
    this.maxDiagnostics = Math.max(25, Number(input.maxDiagnostics || 100));
    this.maxEntitySnapshots = Math.max(10, Number(input.maxEntitySnapshots || 50));
    this.maxTextLength = Math.max(80, Number(input.maxTextLength || 500));
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

  toJSON() {
    return {
      enabled: this.enabled,
      version: this.version,
      strict: this.strict,
      memoryLimit: this.memoryLimit,
      workingMemoryTtlMs: this.workingMemoryTtlMs,
      contextRefreshMs: this.contextRefreshMs,
      providerTimeoutMs: this.providerTimeoutMs,
      maxDiagnostics: this.maxDiagnostics,
      maxEntitySnapshots: this.maxEntitySnapshots,
      maxTextLength: this.maxTextLength,
      providers: { ...this.providers },
      memoryProviders: { ...this.memoryProviders },
      referenceResolvers: { ...this.referenceResolvers },
      contextProviders: { ...this.contextProviders },
      aliases: { ...this.aliases },
      longTermMemory: this.longTermMemory ? '[configured]' : null
    };
  }
}

module.exports = MemoryConfiguration;
module.exports.DEFAULT_PROVIDER_OPTIONS = DEFAULT_PROVIDER_OPTIONS;
