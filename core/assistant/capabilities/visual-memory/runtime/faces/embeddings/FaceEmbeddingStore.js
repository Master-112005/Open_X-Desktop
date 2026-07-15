'use strict';

const { id, normalizeVector, nowIso } = require('../utils/face-utils');

class FaceEmbeddingStore {
  constructor({ state, validator } = {}) {
    this.state = state;
    this.validator = validator;
  }

  addEmbedding({ vector, identityId = null, clusterId = null, photoId = null, faceId = null, source = 'ai-vision', confidence = 0 } = {}) {
    const validation = this.validator.validateEmbedding(vector);
    if (!validation.valid) throw new Error(validation.reason);
    const embeddingId = id('faceemb');
    const record = {
      id: embeddingId,
      identityId,
      clusterId,
      photoId,
      faceId,
      vector: normalizeVector(vector),
      source,
      confidence: Math.max(0, Math.min(1, Number(confidence || 0))),
      createdAt: nowIso()
    };
    this.state.embeddings[embeddingId] = record;
    return record;
  }

  listForIdentity(identityId) {
    return Object.values(this.state.embeddings).filter(item => item.identityId === identityId);
  }

  listForCluster(clusterId) {
    return Object.values(this.state.embeddings).filter(item => item.clusterId === clusterId);
  }

  deleteForIdentity(identityId) {
    let count = 0;
    for (const [embeddingId, embedding] of Object.entries(this.state.embeddings)) {
      if (embedding.identityId === identityId) {
        delete this.state.embeddings[embeddingId];
        count += 1;
      }
    }
    return count;
  }

  deleteEmbedding(embeddingId) {
    const existed = Boolean(this.state.embeddings[embeddingId]);
    delete this.state.embeddings[embeddingId];
    return existed;
  }
}

module.exports = FaceEmbeddingStore;
