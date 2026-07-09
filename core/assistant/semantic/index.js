'use strict';

const { SemanticManager, createDefaultSemanticManager } = require('./SemanticManager');

module.exports = {
  BaseSemanticAnalyzer: require('./BaseSemanticAnalyzer'),
  ConfidenceEngine: require('./ConfidenceEngine'),
  ConversationClassifier: require('./ConversationClassifier'),
  MeaningResolver: require('./MeaningResolver'),
  RelationshipAnalyzer: require('./RelationshipAnalyzer'),
  SemanticConfiguration: require('./SemanticConfiguration'),
  SemanticContext: require('./SemanticContext'),
  SemanticDiagnostics: require('./SemanticDiagnostics'),
  SemanticDictionary: require('./SemanticDictionary'),
  SemanticGraphBuilder: require('./SemanticGraphBuilder'),
  SemanticLogger: require('./SemanticLogger'),
  SemanticManager,
  SemanticNormalizer: require('./SemanticNormalizer'),
  SemanticPipeline: require('./SemanticPipeline'),
  SemanticRegistry: require('./SemanticRegistry'),
  SemanticRepresentation: require('./SemanticRepresentation'),
  SemanticRoleLabeler: require('./SemanticRoleLabeler'),
  SemanticUnderstandingStage: require('./SemanticUnderstandingStage'),
  SimilarityEngine: require('./SimilarityEngine'),
  createDefaultSemanticManager,
  ...require('./SemanticErrors')
};
