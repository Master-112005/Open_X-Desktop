'use strict';

class FaceMemoryConfiguration {
  constructor(options = {}) {
    this.enabled = options.enabled === true;
    this.thresholds = {
      grouping: Number(options.thresholds?.grouping ?? 0.965),
      matching: Number(options.thresholds?.matching ?? 0.92),
      confidence: Number(options.thresholds?.confidence ?? 0.7),
      suggestion: Number(options.thresholds?.suggestion ?? 0.78),
      autoAssignExact: Number(options.thresholds?.autoAssignExact ?? 0.995),
      autoAssignStrong: Number(options.thresholds?.autoAssignStrong ?? 0.965),
      autoAssignKnown: Number(options.thresholds?.autoAssignKnown ?? 0.94),
      autoAssignMargin: Number(options.thresholds?.autoAssignMargin ?? 0.018),
      clusterAutoAssign: Number(options.thresholds?.clusterAutoAssign ?? 0.92),
      clusterAutoAssignMargin: Number(options.thresholds?.clusterAutoAssignMargin ?? 0.024),
      matchingMargin: Number(options.thresholds?.matchingMargin ?? 0.035),
      duplicate: Number(options.thresholds?.duplicate ?? 0.998),
      duplicateCrossPhoto: Number(options.thresholds?.duplicateCrossPhoto ?? 0.9995),
      duplicateBoxIoU: Number(options.thresholds?.duplicateBoxIoU ?? 0.94)
    };
    this.quality = {
      minScanQuality: Math.max(0, Math.min(1, Number(options.quality?.minScanQuality ?? 0.56))),
      minAutoAssignQuality: Math.max(0, Math.min(1, Number(options.quality?.minAutoAssignQuality ?? 0.62))),
      lowQualityThresholdPenalty: Math.max(0, Math.min(0.08, Number(options.quality?.lowQualityThresholdPenalty ?? 0.025)))
    };
    this.enrollment = {
      minUnknownPhotos: Math.max(2, Number(options.enrollment?.minUnknownPhotos || 5)),
      autoAssignMinEvidence: Math.max(2, Number(options.enrollment?.autoAssignMinEvidence || 2)),
      clusterAutoAssignMinEvidence: Math.max(2, Number(options.enrollment?.clusterAutoAssignMinEvidence || 2)),
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
      quality: { ...this.quality },
      enrollment: { ...this.enrollment },
      privacy: { ...this.privacy },
      performance: { ...this.performance }
    };
  }
}

module.exports = FaceMemoryConfiguration;
