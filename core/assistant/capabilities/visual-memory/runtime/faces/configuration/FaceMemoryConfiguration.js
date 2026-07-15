'use strict';

class FaceMemoryConfiguration {
  constructor(options = {}) {
    this.enabled = options.enabled === true;
    this.thresholds = {
      grouping: Number(options.thresholds?.grouping ?? 0.94),
      matching: Number(options.thresholds?.matching ?? 0.92),
      confidence: Number(options.thresholds?.confidence ?? 0.7),
      suggestion: Number(options.thresholds?.suggestion ?? 0.78)
    };
    this.enrollment = {
      minUnknownPhotos: Math.max(2, Number(options.enrollment?.minUnknownPhotos || 5)),
      allowSuggestions: options.enrollment?.allowSuggestions !== false,
      autoCreateIdentities: false
    };
    this.privacy = {
      localOnly: true,
      cloudSync: false,
      matchingEnabled: options.privacy?.matchingEnabled !== false,
      groupingEnabled: options.privacy?.groupingEnabled !== false,
      enrollmentEnabled: options.privacy?.enrollmentEnabled !== false,
      suggestionsEnabled: options.privacy?.suggestionsEnabled !== false
    };
    this.performance = {
      maxEmbeddingsPerIdentity: Math.max(1, Number(options.performance?.maxEmbeddingsPerIdentity || 250)),
      maxUnknownClusters: Math.max(10, Number(options.performance?.maxUnknownClusters || 500))
    };
  }

  toJSON() {
    return {
      enabled: this.enabled,
      thresholds: { ...this.thresholds },
      enrollment: { ...this.enrollment },
      privacy: { ...this.privacy },
      performance: { ...this.performance }
    };
  }
}

module.exports = FaceMemoryConfiguration;
