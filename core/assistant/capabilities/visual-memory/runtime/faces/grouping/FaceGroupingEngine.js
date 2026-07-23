'use strict';

const {
  clamp01,
  faceEmbeddingSimilarity,
  faceBoxIoU,
  faceQualityScore,
  id,
  normalizeFaceBox,
  normalizedFaceBoxDistance,
  nowIso
} = require('../utils/face-utils');
const FaceComparisonEngine = require('../comparison/FaceComparisonEngine');

class FaceGroupingEngine {
  constructor({ state, embeddings, configuration, comparison, diagnostics, events } = {}) {
    this.state = state;
    this.embeddings = embeddings;
    this.configuration = configuration;
    this.comparison = comparison || new FaceComparisonEngine({ configuration });
    this.diagnostics = diagnostics;
    this.events = events;
  }

  groupUnknownFace({ vector, photoId, faceId, faceBox = null, imageWidth = null, imageHeight = null, source = 'ai-vision', confidence = 0, quality: inputQuality = null, metadata = null } = {}) {
    if (!this.configuration.privacy.groupingEnabled) return { skipped: true, reason: 'grouping-disabled' };
    const quality = Number.isFinite(Number(inputQuality))
      ? clamp01(inputQuality)
      : faceQualityScore({
        confidence,
        faceBox,
        imageWidth,
        imageHeight,
        vector,
        qualitySignals: metadata?.qualitySignals || null
      });
    const cluster = this._bestCluster(vector, { quality });
    const qualityPenalty = quality < Number(this.configuration.quality?.minScanQuality ?? 0.56)
      ? Number(this.configuration.quality?.lowQualityThresholdPenalty ?? 0.025)
      : 0;
    const groupingThreshold = this._groupingThreshold(cluster, quality) + qualityPenalty;
    const clusterId = cluster?.similarity >= groupingThreshold ? cluster.cluster.id : id('unknownface');
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
    const normalizedFaceBox = normalizeFaceBox(faceBox, imageWidth, imageHeight);
    const duplicate = this._findDuplicateClusterEmbedding(record, {
      vector,
      photoId,
      faceId,
      faceBox: normalizedFaceBox,
      quality
    });
    if (duplicate) {
      duplicate.confidence = Math.max(Number(duplicate.confidence) || 0, Number(confidence) || 0);
      duplicate.quality = Math.max(Number(duplicate.quality) || 0, Number(quality) || 0);
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
      confidence,
      quality,
      metadata
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
    record.quality = Math.max(record.quality || 0, quality);
    record.matchStrength = Math.max(record.matchStrength || 0, Number(cluster?.similarity || 0));
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

  _bestCluster(vector, options = {}) {
    let best = null;
    for (const cluster of Object.values(this.state.unknownClusters)) {
      if (cluster.status !== 'unknown' || cluster.ignoredAt || cluster.neverAskAgain) continue;
      const embeddings = this.embeddings.listForCluster(cluster.id);
      if (embeddings.length === 0) continue;
      const decision = this.comparison.scoreProbeAgainstSet({ vector, quality: options.quality }, embeddings, {
        faceComparisonSimilarity: this.configuration.thresholds.faceComparison,
        faceComparisonStrongSimilarity: this.configuration.thresholds.faceComparisonStrong
      });
      if (!decision.comparable) continue;
      const similarity = decision.confidence;
      if (!best || similarity > best.similarity) {
        best = {
          cluster,
          similarity,
          bestSimilarity: decision.bestSimilarity,
          centroidSimilarity: decision.centroidSimilarity,
          supportCount: decision.supportCount,
          localDescriptorPair: decision.localDescriptorPair
        };
      }
    }
    return best;
  }

  _groupingThreshold(clusterMatch = null, quality = 0.75) {
    const base = Number(this.configuration.thresholds.grouping ?? 0.94);
    const supportCount = Number(clusterMatch?.supportCount || 0);
    const clusterSize = Number(clusterMatch?.cluster?.embeddingIds?.length || 0);
    const evidenceDiscount = supportCount >= 4 || clusterSize >= 6
      ? 0.018
      : supportCount >= 2 || clusterSize >= 3 ? 0.012 : 0;
    const qualityDiscount = clamp01(quality) >= 0.82 ? 0.006 : 0;
    return Math.max(0.915, base - evidenceDiscount - qualityDiscount);
  }

  _findDuplicateClusterEmbedding(cluster = {}, input = {}) {
    const vector = Array.isArray(input.vector) ? input.vector : [];
    const threshold = Number(this.configuration.thresholds.duplicate ?? 0.998);
    const crossPhotoThreshold = Number(this.configuration.thresholds.duplicateCrossPhoto ?? 0.9995);
    const boxThreshold = Number(this.configuration.thresholds.duplicateBoxIoU ?? 0.94);
    for (const embeddingId of cluster.embeddingIds || []) {
      const embedding = this.state.embeddings?.[embeddingId];
      if (!embedding || !input.photoId || !embedding.photoId) continue;
      const samePhoto = input.photoId === embedding.photoId;
      const similarity = vector.length && Array.isArray(embedding.vector)
        ? faceEmbeddingSimilarity({ vector, quality: input.quality }, embedding)
        : 0;
      if (samePhoto) {
        if (input.faceId && embedding.faceId && input.faceId === embedding.faceId) return embedding;
        if (input.faceBox && embedding.faceBox && faceBoxIoU(input.faceBox, embedding.faceBox) >= boxThreshold) return embedding;
        if (similarity >= threshold) return embedding;
      } else if (similarity >= crossPhotoThreshold &&
        input.faceBox &&
        embedding.faceBox &&
        normalizedFaceBoxDistance(input.faceBox, embedding.faceBox) <= 0.018) {
        return embedding;
      }
    }
    return null;
  }

  _faceBoxIoU(left = {}, right = {}) {
    return faceBoxIoU(left, right);
  }
}

module.exports = FaceGroupingEngine;
