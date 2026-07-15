'use strict';

const { MEMORY_RESULT_TYPES, MEMORY_INTELLIGENCE_VERSION } = require('../contracts/MemoryIntelligenceContracts');

class MemoryRecord {
  constructor(input = {}) {
    this.id = input.id || input.photoId || '';
    this.photoId = input.photoId || this.id;
    this.type = input.type || MEMORY_RESULT_TYPES.PHOTO;
    this.title = input.title || 'Memory';
    this.path = input.path || '';
    this.candidate = input.candidate || null;
    this.vision = input.vision || {};
    this.evidence = input.evidence || {};
    this.collections = Array.isArray(input.collections) ? input.collections.slice() : [];
    this.reasoning = input.reasoning || {};
    this.confidence = Math.max(0, Math.min(1, Number(input.confidence || 0)));
    this.score = Math.max(0, Number(input.score || 0));
    this.createdAt = input.createdAt || input.candidate?.metadata?.createdAt || input.candidate?.photo?.createdAt || null;
    this.version = MEMORY_INTELLIGENCE_VERSION;
  }

  toJSON() {
    return { ...this };
  }
}

module.exports = MemoryRecord;
