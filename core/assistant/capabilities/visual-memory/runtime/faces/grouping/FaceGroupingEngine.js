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

  groupUnknownFace({ vector, photoId, faceId, faceBox = null, imageWidth = null, imageHeight = null, source = 'ai-vision', confidence = 0 } = {}) {
    if (!this.configuration.privacy.groupingEnabled) return { skipped: true, reason: 'grouping-disabled' };
    const cluster = this._bestCluster(vector);
    const clusterId = cluster?.similarity >= this.configuration.thresholds.grouping ? cluster.cluster.id : id('unknownface');
    if (!this.state.unknownClusters[clusterId]) {
      this.state.unknownClusters[clusterId] = {
        id: clusterId,
        status: 'unknown',
        photoIds: [],
        faceIds: [],
        faceBoxes: [],
        representativeFaceBox: null,
        embeddingIds: [],
        firstSeenAt: nowIso(),
        latestSeenAt: null,
        confidence: 0,
        neverAskAgain: false
      };
    }
    const record = this.state.unknownClusters[clusterId];
    const normalizedFaceBox = faceBox && typeof faceBox === 'object'
      ? {
        x: Number(faceBox.x) || 0,
        y: Number(faceBox.y) || 0,
        width: Number(faceBox.width) || 0,
        height: Number(faceBox.height) || 0,
        imageWidth: Number(imageWidth) || Number(faceBox.imageWidth) || null,
        imageHeight: Number(imageHeight) || Number(faceBox.imageHeight) || null
      }
      : null;
    const duplicate = this._findDuplicateClusterEmbedding(record, {
      vector,
      photoId,
      faceId,
      faceBox: normalizedFaceBox
    });
    if (duplicate) {
      duplicate.confidence = Math.max(Number(duplicate.confidence) || 0, Number(confidence) || 0);
      duplicate.lastMatchedAt = nowIso();
      duplicate.matchCount = Math.max(1, Number(duplicate.matchCount) || 1) + 1;
      record.latestSeenAt = nowIso();
      record.confidence = Math.max(record.confidence || 0, Number(confidence) || 0);
      record.duplicateCount = Math.max(0, Number(record.duplicateCount) || 0) + 1;
      this.diagnostics?.record?.('unknown-face-duplicate-suppressed', {
        clusterId,
        embeddingId: duplicate.id,
        photoId: photoId || null
      });
      return { cluster: record, embedding: duplicate, duplicate: true };
    }

    const embedding = this.embeddings.addEmbedding({
      vector,
      clusterId,
      photoId,
      faceId,
      faceBox: normalizedFaceBox,
      imageWidth: normalizedFaceBox?.imageWidth || null,
      imageHeight: normalizedFaceBox?.imageHeight || null,
      source,
      confidence
    });
    record.embeddingIds.push(embedding.id);
    if (photoId && !record.photoIds.includes(photoId)) record.photoIds.push(photoId);
    if (faceId && !record.faceIds.includes(faceId)) record.faceIds.push(faceId);
    if (normalizedFaceBox) {
      const faceBoxRecord = { photoId, faceId, ...normalizedFaceBox };
      record.faceBoxes.push(faceBoxRecord);
      if (!record.representativeFaceBox || confidence >= (record.confidence || 0)) {
        record.representativeFaceBox = faceBoxRecord;
      }
    }
    record.latestSeenAt = nowIso();
    record.confidence = Math.max(record.confidence || 0, confidence);
    this.events?.emit?.('visual-memory.faces.unknown.grouped', { clusterId, photoCount: record.photoIds.length });
    this.diagnostics?.record?.('unknown-face-grouped', { clusterId, photoCount: record.photoIds.length });
    return { cluster: record, embedding, duplicate: false };
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
      if (cluster.status !== 'unknown' || cluster.ignoredAt || cluster.neverAskAgain) continue;
      const embeddings = this.embeddings.listForCluster(cluster.id);
      for (const embedding of embeddings) {
        const similarity = cosineSimilarity(vector, embedding.vector);
        if (!best || similarity > best.similarity) best = { cluster, similarity };
      }
    }
    return best;
  }

  _findDuplicateClusterEmbedding(cluster = {}, input = {}) {
    const vector = Array.isArray(input.vector) ? input.vector : [];
    const threshold = Number(this.configuration.thresholds.duplicate ?? 0.998);
    const boxThreshold = Number(this.configuration.thresholds.duplicateBoxIoU ?? 0.94);
    for (const embeddingId of cluster.embeddingIds || []) {
      const embedding = this.state.embeddings?.[embeddingId];
      if (!embedding || !input.photoId || !embedding.photoId || input.photoId !== embedding.photoId) continue;
      if (input.faceId && embedding.faceId && input.faceId === embedding.faceId) return embedding;
      if (input.faceBox && embedding.faceBox && this._faceBoxIoU(input.faceBox, embedding.faceBox) >= boxThreshold) return embedding;
      if (vector.length && Array.isArray(embedding.vector) && cosineSimilarity(vector, embedding.vector) >= threshold) return embedding;
    }
    return null;
  }

  _faceBoxIoU(left = {}, right = {}) {
    const lx1 = Number(left.x) || 0;
    const ly1 = Number(left.y) || 0;
    const lx2 = lx1 + (Number(left.width) || 0);
    const ly2 = ly1 + (Number(left.height) || 0);
    const rx1 = Number(right.x) || 0;
    const ry1 = Number(right.y) || 0;
    const rx2 = rx1 + (Number(right.width) || 0);
    const ry2 = ry1 + (Number(right.height) || 0);
    const intersectionWidth = Math.max(0, Math.min(lx2, rx2) - Math.max(lx1, rx1));
    const intersectionHeight = Math.max(0, Math.min(ly2, ry2) - Math.max(ly1, ry1));
    const intersection = intersectionWidth * intersectionHeight;
    const leftArea = Math.max(0, lx2 - lx1) * Math.max(0, ly2 - ly1);
    const rightArea = Math.max(0, rx2 - rx1) * Math.max(0, ry2 - ry1);
    const union = leftArea + rightArea - intersection;
    return union > 0 ? intersection / union : 0;
  }
}

module.exports = FaceGroupingEngine;
