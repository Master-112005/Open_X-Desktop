'use strict';

const { LinguisticManager, createDefaultLinguisticManager } = require('./LinguisticManager');
const LINGUISTIC_VERSION = '4.0.0';

module.exports = {
  LINGUISTIC_VERSION,
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
  InputParser: require('./InputParser'),
  LanguageAnalysis: require('./LanguageAnalysis'),
  ModifierDetector: require('./ModifierDetector'),
  NegationDetector: require('./NegationDetector'),
  NlpProcessor: require('./NlpProcessor'),
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
