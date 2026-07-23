'use strict';

const {
  clamp01,
  faceQualityScore
} = require('../utils/face-utils');
const FaceComparisonEngine = require('../comparison/FaceComparisonEngine');

class FaceMatchingEngine {
  constructor({ state, embeddings, configuration, comparison } = {}) {
    this.state = state;
    this.embeddings = embeddings;
    this.configuration = configuration;
    this.comparison = comparison || new FaceComparisonEngine({ configuration });
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
      const scored = this.comparison.scoreProbeAgainstSet(
        { vector, quality: probeQuality, confidence: options.confidence, metadata: options.metadata || null },
        this.embeddings.listForIdentity(identity.id),
        {
          faceComparisonSimilarity: this.configuration.thresholds.faceComparison,
          faceComparisonStrongSimilarity: this.configuration.thresholds.faceComparisonStrong,
          matchingMargin: this.configuration.thresholds.matchingMargin
        }
      );
      if (!scored.comparable) continue;
      const composite = clamp01(scored.confidence);
      if (composite >= this.configuration.thresholds.confidence) {
        matches.push({
          identityId: identity.id,
          profileId: identity.profileId,
          name: this.state.profiles[identity.profileId]?.name || '',
          relationship: this.state.profiles[identity.profileId]?.relationship || identity.relationship || '',
          confidence: Number(composite.toFixed(4)),
          bestSimilarity: scored.bestSimilarityRounded,
          centroidSimilarity: scored.centroidSimilarityRounded,
          supportCount: scored.supportCount,
          quality: scored.qualityRounded,
          evidenceCount: scored.evidenceCount,
          localDescriptorPair: scored.localDescriptorPair,
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
