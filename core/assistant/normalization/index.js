'use strict';

const { NormalizationManager, createDefaultNormalizationManager } = require('./NormalizationManager');

module.exports = {
  AbbreviationExpander: require('./AbbreviationExpander'),
  BaseNormalizer: require('./BaseNormalizer'),
  ContractionResolver: require('./ContractionResolver'),
  DateNormalizer: require('./DateNormalizer'),
  EmojiInterpreter: require('./EmojiInterpreter'),
  InputCleaner: require('./InputCleaner'),
  LanguageNormalizationStage: require('./LanguageNormalizationStage'),
  LanguageSwitcher: require('./LanguageSwitcher'),
  NormalizationConfiguration: require('./NormalizationConfiguration'),
  NormalizationContext: require('./NormalizationContext'),
  NormalizationDiagnostics: require('./NormalizationDiagnostics'),
  NormalizationLogger: require('./NormalizationLogger'),
  NormalizationManager,
  NormalizationPipeline: require('./NormalizationPipeline'),
  NormalizedInput: require('./NormalizedInput'),
  NormalizerRegistry: require('./NormalizerRegistry'),
  NumberNormalizer: require('./NumberNormalizer'),
  PunctuationNormalizer: require('./PunctuationNormalizer'),
  RepeatedWordCleaner: require('./RepeatedWordCleaner'),
  SlangNormalizer: require('./SlangNormalizer'),
  SpellRepair: require('./SpellRepair'),
  TimeNormalizer: require('./TimeNormalizer'),
  UnicodeNormalizer: require('./UnicodeNormalizer'),
  UnitNormalizer: require('./UnitNormalizer'),
  WhitespaceNormalizer: require('./WhitespaceNormalizer'),
  createDefaultNormalizationManager,
  ...require('./NormalizationErrors')
};
