'use strict';

const { cosineSimilarity } = require('../utils/face-utils');

class FaceMatchingEngine {
  constructor({ state, embeddings, configuration } = {}) {
    this.state = state;
    this.embeddings = embeddings;
    this.configuration = configuration;
  }

  match(vector) {
    if (!this.configuration.privacy.matchingEnabled) return { matches: [], disabled: true };
    const matches = [];
    for (const identity of Object.values(this.state.identities)) {
      let best = 0;
      let evidenceCount = 0;
      for (const embedding of this.embeddings.listForIdentity(identity.id)) {
        evidenceCount += 1;
        best = Math.max(best, cosineSimilarity(vector, embedding.vector));
      }
      if (best >= this.configuration.thresholds.confidence) {
        matches.push({
          identityId: identity.id,
          profileId: identity.profileId,
          name: this.state.profiles[identity.profileId]?.name || '',
          relationship: this.state.profiles[identity.profileId]?.relationship || identity.relationship || '',
          confidence: Number(best.toFixed(4)),
          evidenceCount,
          ambiguous: best < this.configuration.thresholds.matching
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
