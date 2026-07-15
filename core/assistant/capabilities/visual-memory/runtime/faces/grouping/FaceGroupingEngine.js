'use strict';

const { cosineSimilarity, id, nowIso } = require('../utils/face-utils');

class FaceGroupingEngine {
  constructor({ state, embeddings, configuration, diagnostics, events } = {}) {
    this.state = state;
    this.embeddings = embeddings;
    this.configuration = configuration;
    this.diagnostics = diagnostics;
    this.events = events;
  }

  groupUnknownFace({ vector, photoId, faceId, confidence = 0 } = {}) {
    if (!this.configuration.privacy.groupingEnabled) return { skipped: true, reason: 'grouping-disabled' };
    const cluster = this._bestCluster(vector);
    const clusterId = cluster?.similarity >= this.configuration.thresholds.grouping ? cluster.cluster.id : id('unknownface');
    if (!this.state.unknownClusters[clusterId]) {
      this.state.unknownClusters[clusterId] = {
        id: clusterId,
        status: 'unknown',
        photoIds: [],
        faceIds: [],
        embeddingIds: [],
        firstSeenAt: nowIso(),
        latestSeenAt: null,
        confidence: 0,
        neverAskAgain: false
      };
    }
    const record = this.state.unknownClusters[clusterId];
    const embedding = this.embeddings.addEmbedding({ vector, clusterId, photoId, faceId, confidence });
    record.embeddingIds.push(embedding.id);
    if (photoId && !record.photoIds.includes(photoId)) record.photoIds.push(photoId);
    if (faceId && !record.faceIds.includes(faceId)) record.faceIds.push(faceId);
    record.latestSeenAt = nowIso();
    record.confidence = Math.max(record.confidence || 0, confidence);
    this.events?.emit?.('visual-memory.faces.unknown.grouped', { clusterId, photoCount: record.photoIds.length });
    this.diagnostics?.record?.('unknown-face-grouped', { clusterId, photoCount: record.photoIds.length });
    return { cluster: record, embedding };
  }

  getEnrollmentSuggestions() {
    if (!this.configuration.enrollment.allowSuggestions || !this.configuration.privacy.suggestionsEnabled) return [];
    return Object.values(this.state.unknownClusters)
      .filter(cluster => cluster.status === 'unknown'
        && !cluster.ignoredAt
        && !cluster.neverAskAgain
        && cluster.photoIds.length >= this.configuration.enrollment.minUnknownPhotos)
      .map(cluster => ({
        clusterId: cluster.id,
        photoCount: cluster.photoIds.length,
        firstSeenAt: cluster.firstSeenAt,
        latestSeenAt: cluster.latestSeenAt,
        confidence: cluster.confidence,
        prompt: `I found someone who appears in ${cluster.photoIds.length} photos. Would you like to identify them?`,
        options: ['Name Person', 'Ignore', 'Never Ask Again', 'Delete Face Data', 'Later']
      }));
  }

  markNeverAskAgain(clusterId) {
    if (this.state.unknownClusters[clusterId]) this.state.unknownClusters[clusterId].neverAskAgain = true;
    return this.state.unknownClusters[clusterId] || null;
  }

  deleteCluster(clusterId) {
    const cluster = this.state.unknownClusters[clusterId];
    if (!cluster) return false;
    for (const embeddingId of cluster.embeddingIds || []) this.embeddings.deleteEmbedding(embeddingId);
    delete this.state.unknownClusters[clusterId];
    return true;
  }

  _bestCluster(vector) {
    let best = null;
    for (const cluster of Object.values(this.state.unknownClusters)) {
      const embeddings = this.embeddings.listForCluster(cluster.id);
      for (const embedding of embeddings) {
        const similarity = cosineSimilarity(vector, embedding.vector);
        if (!best || similarity > best.similarity) best = { cluster, similarity };
      }
    }
    return best;
  }
}

module.exports = FaceGroupingEngine;
