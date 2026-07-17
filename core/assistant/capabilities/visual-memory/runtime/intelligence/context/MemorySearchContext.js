'use strict';

class MemorySearchContext {
  constructor(input = {}) {
    this.visualQuery = input.visualQuery || null;
    this.candidatePool = input.candidatePool || null;
    this.visionResults = input.visionResults || {};
    this.assistantContext = input.assistantContext || input.pipelineContext || null;
    this.previousSearch = input.previousSearch || null;
    this.options = { ...(input.options || {}) };
    this.faceSearchContext = input.faceSearchContext || input.candidatePool?.faceSearchContext || null;
    this.createdAt = Date.now();
  }

  getCandidates() {
    return Array.isArray(this.candidatePool?.candidates) ? this.candidatePool.candidates : [];
  }

  getVisionFor(candidate) {
    const id = candidate?.photoId || candidate?.id || '';
    return this.visionResults?.[id] || candidate?.vision || {};
  }

  getFaceSearchContext() {
    return this.faceSearchContext || this.candidatePool?.faceSearchContext || null;
  }
}

module.exports = MemorySearchContext;
