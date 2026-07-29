'use strict';

const { NormalizationManager, createDefaultNormalizationManager } = require('./NormalizationManager');
const NormalizationConfiguration = require('./NormalizationConfiguration');

const NORMALIZATION_LAYER_VERSION = '3.1.0';

module.exports = {
  AbbreviationExpander: require('./AbbreviationExpander'),
  BaseNormalizer: require('./BaseNormalizer'),
  ContractionResolver: require('./ContractionResolver'),
  CommandPreprocessor: require('./CommandPreprocessor'),
  AssistantLexicon: require('./AssistantLexicon'),
  DateNormalizer: require('./DateNormalizer'),
  EmojiInterpreter: require('./EmojiInterpreter'),
  InputCleaner: require('./InputCleaner'),
  LanguageNormalizationStage: require('./LanguageNormalizationStage'),
  LanguageSwitcher: require('./LanguageSwitcher'),
  NORMALIZATION_LAYER_VERSION,
  NormalizationConfiguration,
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
