'use strict';

const {
  clamp01,
  faceEmbeddingSimilarity,
  faceQualityScore,
  weightedMeanVector
} = require('../utils/face-utils');

class FaceMatchingEngine {
  constructor({ state, embeddings, configuration } = {}) {
    this.state = state;
    this.embeddings = embeddings;
    this.configuration = configuration;
  }

  match(vector, options = {}) {
    if (!this.configuration.privacy.matchingEnabled) return { matches: [], disabled: true };
    const probeQuality = Number.isFinite(Number(options.quality))
      ? clamp01(options.quality)
      : faceQualityScore({
        confidence: options.confidence,
        faceBox: options.faceBox,
        imageWidth: options.imageWidth,
        imageHeight: options.imageHeight,
        vector,
        qualitySignals: options.metadata?.qualitySignals || null
      });
    const matches = [];
    for (const identity of Object.values(this.state.identities)) {
      const scored = this.embeddings.listForIdentity(identity.id)
        .map(embedding => ({
          embedding,
          similarity: faceEmbeddingSimilarity({ vector, quality: probeQuality }, embedding),
          quality: clamp01(embedding.quality ?? embedding.confidence ?? 0.75)
        }))
        .sort((left, right) => right.similarity - left.similarity);
      const evidenceCount = scored.length;
      if (evidenceCount === 0) continue;
      const best = scored[0].similarity;
      const top = scored.slice(0, Math.min(5, scored.length));
      const topMean = top.reduce((sum, item) => sum + item.similarity, 0) / top.length;
      const evidenceQuality = top.reduce((sum, item) => sum + item.quality, 0) / top.length;
      const centroid = weightedMeanVector(scored.map(item => ({
        vector: item.embedding.vector,
        weight: Math.max(0.05, item.quality)
      })));
      const centroidSimilarity = centroid.length
        ? faceEmbeddingSimilarity({ vector, quality: probeQuality }, { vector: centroid, quality: evidenceQuality || 0.75 })
        : best;
      const supportCount = scored.filter(item => item.similarity >= this.configuration.thresholds.suggestion).length;
      const supportBoost = Math.min(0.018, supportCount * 0.004);
      const qualityFactor = 0.94 + (Math.min(probeQuality, evidenceQuality) * 0.06);
      const composite = clamp01(((best * 0.58) + (topMean * 0.22) + (centroidSimilarity * 0.20) + supportBoost) * qualityFactor);
      if (composite >= this.configuration.thresholds.confidence) {
        matches.push({
          identityId: identity.id,
          profileId: identity.profileId,
          name: this.state.profiles[identity.profileId]?.name || '',
          relationship: this.state.profiles[identity.profileId]?.relationship || identity.relationship || '',
          confidence: Number(composite.toFixed(4)),
          bestSimilarity: Number(best.toFixed(4)),
          centroidSimilarity: Number(centroidSimilarity.toFixed(4)),
          supportCount,
          quality: Number(Math.min(probeQuality, evidenceQuality).toFixed(4)),
          evidenceCount,
          ambiguous: composite < this.configuration.thresholds.matching
        });
      }
    }
    matches.sort((left, right) => right.confidence - left.confidence);
    const best = matches[0] || null;
    const second = matches[1] || null;
    if (best) {
      const margin = second ? best.confidence - second.confidence : 1;
      const requiredMargin = Number(this.configuration.thresholds.matchingMargin ?? 0.035);
      best.margin = Number(margin.toFixed(4));
      best.secondBestIdentityId = second?.identityId || null;
      best.secondBestConfidence = second?.confidence || 0;
      best.ambiguous = best.ambiguous || margin < requiredMargin;
      best.decision = best.ambiguous ? 'review' : 'match';
    }
    return { matches, best, second };
  }
}

module.exports = FaceMatchingEngine;
