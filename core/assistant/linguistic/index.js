'use strict';

const { LinguisticManager, createDefaultLinguisticManager } = require('./LinguisticCore');
const LINGUISTIC_VERSION = '4.0.0';

module.exports = {
  LINGUISTIC_VERSION,
  ...require('./LinguisticAnalyzers'),
  ...require('./LinguisticCore'),
  InputParser: require('./InputParser'),
  LanguageAnalysis: require('./LanguageAnalysis'),
  NlpProcessor: require('./NlpProcessor'),
  LinguisticManager,
  createDefaultLinguisticManager
};