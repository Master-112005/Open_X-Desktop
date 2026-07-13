'use strict';

const { LearningManager, createDefaultLearningManager } = require('./LearningManager');
const LEARNING_LAYER_VERSION = '12.1.0';

module.exports = {
  LEARNING_LAYER_VERSION,
  LearningManager,
  createDefaultLearningManager,
  ActiveLearningManager: require('./ActiveLearningManager'),
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
  ActiveLearningStore: require('./ActiveLearningStore'),
  AliasStore: require('./AliasStore'),
  BaseStore: require('./BaseStore'),
  CorrectionStore: require('./CorrectionStore'),
  LearningGuard: require('./LearningGuard'),
  LearningLanguage: require('./LearningLanguage'),
  PreferenceStore: require('./PreferenceStore'),
  UsageStatsStore: require('./UsageStatsStore'),
  WorkflowStore: require('./WorkflowStore'),
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
