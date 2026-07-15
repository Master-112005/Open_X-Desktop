'use strict';

class VisualMemoryLearningDashboard {
  constructor({ state, diagnostics, configuration } = {}) {
    this.state = state;
    this.diagnostics = diagnostics;
    this.configuration = configuration;
  }

  snapshot() {
    return {
      enabled: this.configuration.enabled,
      privacy: { ...this.configuration.privacy },
      preferences: Object.values(this.state.preferences),
      corrections: this.state.corrections.slice(),
      feedback: this.state.feedback.slice(0, 50),
      ranking: Object.values(this.state.ranking),
      relationships: this.state.relationships.slice(),
      events: this.state.events.slice(),
      collections: this.state.collections.slice(),
      timelines: this.state.timelines.slice(),
      searchPatterns: this.state.searchPatterns.slice(),
      recommendations: this.state.recommendations.slice(0, this.configuration.recommendations.maxItems),
      diagnostics: this.diagnostics.summary(),
      audit: this.state.audit.slice(0, 100)
    };
  }
}

module.exports = VisualMemoryLearningDashboard;
