'use strict';

module.exports = {
  VisualMemoryLearningEngine: require('./engine/VisualMemoryLearningEngine'),
  VisualMemoryLearningConfiguration: require('./configuration/VisualMemoryLearningConfiguration'),
  VisualMemoryLearningDiagnostics: require('./diagnostics/VisualMemoryLearningDiagnostics'),
  VisualMemoryLearningLifecycle: require('./lifecycle/VisualMemoryLearningLifecycle'),
  VisualMemoryLearningValidator: require('./validation/VisualMemoryLearningValidator'),
  VisualMemoryFeedbackEngine: require('./feedback/VisualMemoryFeedbackEngine'),
  VisualMemoryCorrectionEngine: require('./corrections/VisualMemoryCorrectionEngine'),
  VisualMemoryPreferenceEngine: require('./preferences/VisualMemoryPreferenceEngine'),
  VisualMemoryRankingLearning: require('./ranking/VisualMemoryRankingLearning'),
  VisualMemoryRecommendationEngine: require('./recommendations/VisualMemoryRecommendationEngine'),
  VisualMemoryLearningDashboard: require('./dashboard/VisualMemoryLearningDashboard'),
  ...require('./contracts/VisualMemoryLearningContracts'),
  ...require('./events/VisualMemoryLearningEvents')
};
