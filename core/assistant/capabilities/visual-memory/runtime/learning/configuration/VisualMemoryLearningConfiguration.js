'use strict';

class VisualMemoryLearningConfiguration {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.ranking = {
      enabled: options.ranking?.enabled !== false,
      positiveWeight: Number(options.ranking?.positiveWeight || 0.08),
      negativeWeight: Number(options.ranking?.negativeWeight || -0.12),
      maxAdjustment: Number(options.ranking?.maxAdjustment || 0.35)
    };
    this.recommendations = {
      enabled: options.recommendations?.enabled !== false,
      maxItems: Math.max(1, Number(options.recommendations?.maxItems || 5)),
      minConfidence: Number(options.recommendations?.minConfidence || 0.55)
    };
    this.sensitivity = {
      feedback: Number(options.sensitivity?.feedback || 0.8),
      correction: Number(options.sensitivity?.correction || 0.95),
      preference: Number(options.sensitivity?.preference || 0.9)
    };
    this.privacy = {
      localOnly: true,
      exportable: true,
      resettable: true,
      hiddenLearning: false
    };
    this.retention = {
      maxEvents: Math.max(100, Number(options.retention?.maxEvents || 1000)),
      maxCorrections: Math.max(50, Number(options.retention?.maxCorrections || 500)),
      maxRecommendations: Math.max(20, Number(options.retention?.maxRecommendations || 200))
    };
    this.performance = {
      backgroundOnly: true,
      maxEventsPerLearn: Math.max(1, Number(options.performance?.maxEventsPerLearn || 25))
    };
  }

  toJSON() {
    return {
      enabled: this.enabled,
      ranking: { ...this.ranking },
      recommendations: { ...this.recommendations },
      sensitivity: { ...this.sensitivity },
      privacy: { ...this.privacy },
      retention: { ...this.retention },
      performance: { ...this.performance }
    };
  }
}

module.exports = VisualMemoryLearningConfiguration;
