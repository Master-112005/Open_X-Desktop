'use strict';

class FaceTimelineManager {
  constructor({ state, embeddings } = {}) {
    this.state = state;
    this.embeddings = embeddings;
  }

  getTimeline(identityId) {
    const identity = this.state.identities[identityId];
    if (!identity) return null;
    const embeddings = this.embeddings.listForIdentity(identityId);
    const dates = embeddings.map(item => Date.parse(item.createdAt)).filter(Boolean).sort((a, b) => a - b);
    return {
      identityId,
      firstAppearance: dates.length ? new Date(dates[0]).toISOString() : null,
      latestAppearance: dates.length ? new Date(dates[dates.length - 1]).toISOString() : null,
      frequency: embeddings.length,
      photoCount: new Set(embeddings.map(item => item.photoId).filter(Boolean)).size
    };
  }
}

module.exports = FaceTimelineManager;
