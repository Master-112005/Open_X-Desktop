'use strict';

const { clamp, normalizeKey, nowIso } = require('../utils/learning-utils');

class VisualMemoryRankingLearning {
  constructor({ state, configuration, events } = {}) {
    this.state = state;
    this.configuration = configuration;
    this.events = events;
  }

  applyFeedback(feedback) {
    if (!this.configuration.ranking.enabled) return null;
    const key = normalizeKey(feedback.memoryId || feedback.photoId || feedback.searchId || feedback.type);
    const current = this.state.ranking[key] || { key, score: 0, positive: 0, negative: 0, updatedAt: null };
    const positive = ['selected-result', 'favorite', 'opened', 'viewed-long', 'confirmed'].includes(feedback.type);
    const delta = positive ? this.configuration.ranking.positiveWeight : this.configuration.ranking.negativeWeight;
    current.score = clamp(current.score + delta, -this.configuration.ranking.maxAdjustment, this.configuration.ranking.maxAdjustment);
    current.positive += positive ? 1 : 0;
    current.negative += positive ? 0 : 1;
    current.updatedAt = nowIso();
    this.state.ranking[key] = current;
    this.events?.emit?.('visual-memory.learning.ranking.updated', current);
    return current;
  }

  adaptResults(results = []) {
    return results.map(result => {
      const key = normalizeKey(result.id || result.photoId);
      const adjustment = this.state.ranking[key]?.score || this.state.ranking[normalizeKey(result.photoId)]?.score || 0;
      return {
        ...result,
        learnedAdjustment: adjustment,
        confidence: Math.max(0, Math.min(1, Number(result.confidence || 0) + adjustment)),
        score: Number(result.score || 0) + adjustment * 100
      };
    }).sort((left, right) => (right.score || 0) - (left.score || 0));
  }
}

module.exports = VisualMemoryRankingLearning;
