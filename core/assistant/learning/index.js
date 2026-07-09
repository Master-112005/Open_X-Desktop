'use strict';

const { LearningManager, createDefaultLearningManager } = require('./LearningManager');

module.exports = {
  LearningManager,
  createDefaultLearningManager,
  LearningPipeline: require('./LearningPipeline'),
  LearningContext: require('./LearningContext'),
  LearningRegistry: require('./LearningRegistry'),
  BaseLearningModule: require('./BaseLearningModule'),
  CorrectionLearning: require('./CorrectionLearning'),
  AliasLearning: require('./AliasLearning'),
  PreferenceLearning: require('./PreferenceLearning'),
  HabitLearning: require('./HabitLearning'),
  WorkflowLearning: require('./WorkflowLearning'),
  ConversationLearning: require('./ConversationLearning'),
  UsageLearning: require('./UsageLearning'),
  PatternLearning: require('./PatternLearning'),
  FeedbackLearning: require('./FeedbackLearning'),
  LearningPolicy: require('./LearningPolicy'),
  LearningStorage: require('./LearningStorage'),
  LearningValidator: require('./LearningValidator'),
  LearningAnalytics: require('./LearningAnalytics'),
  LearningConfiguration: require('./LearningConfiguration'),
  LearningDiagnostics: require('./LearningDiagnostics'),
  LearningLogger: require('./LearningLogger'),
  LearningResult: require('./LearningResult'),
  LearningStage: require('./LearningStage'),
  ...require('./LearningErrors')
};
