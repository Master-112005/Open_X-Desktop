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
      for (const embedding of this.embeddings.listForIdentity(identity.id)) {
        best = Math.max(best, cosineSimilarity(vector, embedding.vector));
      }
      if (best >= this.configuration.thresholds.confidence) {
        matches.push({
          identityId: identity.id,
          profileId: identity.profileId,
          name: this.state.profiles[identity.profileId]?.name || '',
          confidence: Number(best.toFixed(4)),
          ambiguous: best < this.configuration.thresholds.matching
        });
      }
    }
    matches.sort((left, right) => right.confidence - left.confidence);
    return { matches, best: matches[0] || null };
  }
}

module.exports = FaceMatchingEngine;
