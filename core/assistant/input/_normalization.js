'use strict';

const {
  AbbreviationExpander,
  BaseNormalizer,
  ContractionResolver,
  DateNormalizer,
  EmojiInterpreter,
  InputCleaner,
  LanguageSwitcher,
  NumberNormalizer,
  PunctuationNormalizer,
  RepeatedWordCleaner,
  SlangNormalizer,
  SpellRepair,
  TimeNormalizer,
  UnicodeNormalizer,
  UnitNormalizer,
  WhitespaceNormalizer
} = require('./Normalizers');
const {
  NormalizationConfiguration,
  NormalizationContext,
  NormalizationDiagnostics,
  NormalizationLogger,
  NormalizerRegistry,
  NormalizationPipeline,
  NormalizationManager,
  LanguageNormalizationStage,
  createDefaultNormalizationManager,
  NormalizationError,
  InvalidUnicodeError,
  SpellRepairError,
  LanguageDetectionError,
  ConfigurationError,
  NormalizerExecutionError,
  NormalizerTimeoutError
} = require('./NormalizationCore');
const CommandPreprocessor = require('./CommandPreprocessor');
const AssistantLexicon = require('./AssistantLexicon');
const NormalizedInput = require('./NormalizedInput');

const NORMALIZATION_LAYER_VERSION = '3.1.0';

module.exports = {
  AbbreviationExpander,
  BaseNormalizer,
  ContractionResolver,
  CommandPreprocessor,
  AssistantLexicon,
  DateNormalizer,
  EmojiInterpreter,
  InputCleaner,
  LanguageNormalizationStage,
  LanguageSwitcher,
  NORMALIZATION_LAYER_VERSION,
  NormalizationConfiguration,
  NormalizationContext,
  NormalizationDiagnostics,
  NormalizationLogger,
  NormalizationManager,
  NormalizationPipeline,
  NormalizedInput,
  NormalizerRegistry,
  NumberNormalizer,
  PunctuationNormalizer,
  RepeatedWordCleaner,
  SlangNormalizer,
  SpellRepair,
  TimeNormalizer,
  UnicodeNormalizer,
  UnitNormalizer,
  WhitespaceNormalizer,
  createDefaultNormalizationManager,
  NormalizationError,
  InvalidUnicodeError,
  SpellRepairError,
  LanguageDetectionError,
  ConfigurationError,
  NormalizerExecutionError,
  NormalizerTimeoutError
};