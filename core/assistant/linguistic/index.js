'use strict';

const { LinguisticManager, createDefaultLinguisticManager } = require('./LinguisticManager');

module.exports = {
  AnalyzerRegistry: require('./AnalyzerRegistry'),
  BaseAnalyzer: require('./BaseAnalyzer'),
  ClauseAnalyzer: require('./ClauseAnalyzer'),
  DependencyParser: require('./DependencyParser'),
  LinguisticConfiguration: require('./LinguisticConfiguration'),
  LinguisticContext: require('./LinguisticContext'),
  LinguisticDiagnostics: require('./LinguisticDiagnostics'),
  LinguisticGraph: require('./LinguisticGraph'),
  LinguisticLogger: require('./LinguisticLogger'),
  LinguisticManager,
  LinguisticPipeline: require('./LinguisticPipeline'),
  LinguisticUnderstandingStage: require('./LinguisticUnderstandingStage'),
  ModifierDetector: require('./ModifierDetector'),
  NegationDetector: require('./NegationDetector'),
  ObjectDetector: require('./ObjectDetector'),
  POSTagger: require('./POSTagger'),
  PronounResolver: require('./PronounResolver'),
  QuestionDetector: require('./QuestionDetector'),
  SentenceSplitter: require('./SentenceSplitter'),
  SubjectDetector: require('./SubjectDetector'),
  Tokenizer: require('./Tokenizer'),
  VerbDetector: require('./VerbDetector'),
  createDefaultLinguisticManager,
  ...require('./LinguisticErrors')
};
