'use strict';

const VISUAL_MEMORY_LEARNING_VERSION = '9.0.0';

const VISUAL_MEMORY_LEARNING_OUT_OF_SCOPE = Object.freeze([
  'model-retraining',
  'neural-network-fine-tuning',
  'online-model-learning',
  'cloud-learning',
  'shared-learning',
  'cross-user-learning',
  'automatic-relationship-creation',
  'automatic-face-naming',
  'emotion-prediction',
  'behavior-prediction',
  'autonomous-decision-making'
]);

module.exports = Object.freeze({
  VISUAL_MEMORY_LEARNING_VERSION,
  VISUAL_MEMORY_LEARNING_OUT_OF_SCOPE,
  LearningContract: Object.freeze({
    extendsExistingLearningEngine: true,
    localOnly: true,
    userControlled: true,
    retrainsModels: false,
    outOfScope: VISUAL_MEMORY_LEARNING_OUT_OF_SCOPE
  }),
  FeedbackContract: Object.freeze({ examples: Object.freeze(['selected-result', 'closed-immediately', 'favorited-memory', 'repeated-search']) }),
  CorrectionContract: Object.freeze({ types: Object.freeze(['face', 'location', 'event', 'document', 'collection', 'timeline']) }),
  PreferenceContract: Object.freeze({ types: Object.freeze(['album', 'collection', 'people', 'location', 'timeline-view', 'sorting', 'filters', 'thumbnail-size', 'viewer']) }),
  RankingContract: Object.freeze({ signals: Object.freeze(['selected-results', 'ignored-results', 'favorites', 'search-history', 'recent-interactions', 'corrections']) }),
  RecommendationContract: Object.freeze({ explainable: true, intrusive: false }),
  RelationshipLearningContract: Object.freeze({ duplicateStorage: false, updatesExistingRelationshipSystem: true }),
  EventLearningContract: Object.freeze({ userSpecificEvents: true, recurringEvents: true }),
  TimelineLearningContract: Object.freeze({ shortcuts: true, preferredNavigation: true }),
  PersonalizationContract: Object.freeze({ reversible: true, exportable: true, resettable: true }),
  ConfigurationContract: Object.freeze({ sections: Object.freeze(['enabled', 'ranking', 'recommendations', 'sensitivity', 'privacy', 'retention', 'history']) }),
  DiagnosticsContract: Object.freeze({ tracks: Object.freeze(['learning-events', 'corrections', 'preferences', 'ranking', 'recommendations', 'performance', 'errors', 'effectiveness']) })
});
