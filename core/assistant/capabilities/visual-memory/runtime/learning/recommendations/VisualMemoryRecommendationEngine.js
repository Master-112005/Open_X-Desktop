'use strict';

const { boundedPush, id, nowIso } = require('../utils/learning-utils');

class VisualMemoryRecommendationEngine {
  constructor({ state, configuration, events } = {}) {
    this.state = state;
    this.configuration = configuration;
    this.events = events;
  }

  generate(context = {}) {
    if (!this.configuration.recommendations.enabled) return [];
    const recommendations = [];
    const frequentCollection = this._topPreference('collection');
    if (frequentCollection) {
      recommendations.push(this._recommendation('collection', `You often open ${frequentCollection.value}.`, {
        reason: 'frequent-collection',
        confidence: frequentCollection.confidence || 0.65
      }));
    }
    const recentSearch = this.state.feedback.find(item => item.type === 'search-repeated' || item.searchId);
    if (recentSearch) {
      recommendations.push(this._recommendation('continue-search', 'Continue your previous visual memory search.', {
        reason: 'recent-search',
        searchId: recentSearch.searchId,
        confidence: 0.62
      }));
    }
    const correction = this.state.corrections.find(item => !item.undone);
    if (correction) {
      recommendations.push(this._recommendation('review-correction', `Review learned ${correction.type} correction.`, {
        reason: 'recent-correction',
        correctionId: correction.id,
        confidence: 0.6
      }));
    }
    const filtered = recommendations
      .filter(item => item.confidence >= this.configuration.recommendations.minConfidence)
      .slice(0, this.configuration.recommendations.maxItems);
    for (const recommendation of filtered) {
      boundedPush(this.state.recommendations, recommendation, this.configuration.retention.maxRecommendations);
      this.events?.emit?.('visual-memory.learning.recommendation.created', recommendation);
    }
    return filtered;
  }

  suggestions() {
    return this.state.recommendations.slice(0, this.configuration.recommendations.maxItems);
  }

  _topPreference(type) {
    return Object.values(this.state.preferences).find(item => item.type === type) || null;
  }

  _recommendation(type, message, metadata = {}) {
    return {
      id: id('vmrec'),
      type,
      message,
      explainable: true,
      intrusive: false,
      confidence: metadata.confidence || 0.55,
      metadata,
      createdAt: nowIso()
    };
  }
}

module.exports = VisualMemoryRecommendationEngine;
