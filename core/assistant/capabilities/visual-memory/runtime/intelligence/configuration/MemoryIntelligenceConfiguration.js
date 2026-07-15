'use strict';

class MemoryIntelligenceConfiguration {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.ranking = {
      contextWeight: Number(options.ranking?.contextWeight ?? 0.18),
      relationshipWeight: Number(options.ranking?.relationshipWeight ?? 0.12),
      timelineWeight: Number(options.ranking?.timelineWeight ?? 0.14),
      visualWeight: Number(options.ranking?.visualWeight ?? 0.26),
      candidateWeight: Number(options.ranking?.candidateWeight ?? 0.18),
      similarityWeight: Number(options.ranking?.similarityWeight ?? 0.12)
    };
    this.search = {
      defaultLimit: Math.max(1, Number(options.search?.defaultLimit || 50)),
      timeoutMs: Math.max(100, Number(options.search?.timeoutMs || 15000)),
      cacheSize: Math.max(0, Number(options.search?.cacheSize || 50))
    };
    this.collections = {
      enabled: options.collections?.enabled !== false,
      minItems: Math.max(1, Number(options.collections?.minItems || 2))
    };
    this.confidence = {
      minimumResultConfidence: Math.max(0, Math.min(1, Number(options.confidence?.minimumResultConfidence || 0.15)))
    };
  }

  toJSON() {
    return {
      enabled: this.enabled,
      ranking: { ...this.ranking },
      search: { ...this.search },
      collections: { ...this.collections },
      confidence: { ...this.confidence }
    };
  }
}

module.exports = MemoryIntelligenceConfiguration;
