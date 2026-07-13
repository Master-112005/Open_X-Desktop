'use strict';

const NormalizationConfiguration = require('./NormalizationConfiguration');
const NormalizationContext = require('./NormalizationContext');
const NormalizationPipeline = require('./NormalizationPipeline');
const NormalizerRegistry = require('./NormalizerRegistry');
const InputCleaner = require('./InputCleaner');
const WhitespaceNormalizer = require('./WhitespaceNormalizer');
const UnicodeNormalizer = require('./UnicodeNormalizer');
const RepeatedWordCleaner = require('./RepeatedWordCleaner');
const PunctuationNormalizer = require('./PunctuationNormalizer');
const ContractionResolver = require('./ContractionResolver');
const AbbreviationExpander = require('./AbbreviationExpander');
const SlangNormalizer = require('./SlangNormalizer');
const SpellRepair = require('./SpellRepair');
const NumberNormalizer = require('./NumberNormalizer');
const DateNormalizer = require('./DateNormalizer');
const TimeNormalizer = require('./TimeNormalizer');
const UnitNormalizer = require('./UnitNormalizer');
const EmojiInterpreter = require('./EmojiInterpreter');
const LanguageSwitcher = require('./LanguageSwitcher');
const { CommandPreprocessorNormalizer } = require('./CommandPreprocessor');

class NormalizationManager {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof NormalizationConfiguration
      ? options.configuration
      : new NormalizationConfiguration(options.configuration || options);
    this.registry = options.registry || new NormalizerRegistry();
    this.pipeline = options.pipeline || null;
    this.logger = options.logger || null;
    this.defaultNormalizersRegistered = false;
    if (options.defaultNormalizers !== false) this._registerDefaults();
  }

  _registerDefaults() {
    if (this.defaultNormalizersRegistered) return;
    const defaults = [
      [InputCleaner, 'input.cleaner', 10],
      [WhitespaceNormalizer, 'whitespace.normalizer', 20],
      [UnicodeNormalizer, 'unicode.normalizer', 30],
      [RepeatedWordCleaner, 'repeated.word.cleaner', 40],
      [PunctuationNormalizer, 'punctuation.normalizer', 50],
      [ContractionResolver, 'contraction.resolver', 60],
      [AbbreviationExpander, 'abbreviation.expander', 70],
      [SlangNormalizer, 'slang.normalizer', 80],
      [SpellRepair, 'spell.repair', 90],
      [NumberNormalizer, 'number.normalizer', 100],
      [DateNormalizer, 'date.normalizer', 110],
      [TimeNormalizer, 'time.normalizer', 120],
      [UnitNormalizer, 'unit.normalizer', 130],
      [EmojiInterpreter, 'emoji.interpreter', 140],
      [CommandPreprocessorNormalizer, 'command.preprocessor', 145],
      [LanguageSwitcher, 'language.switcher', 150]
    ];

    defaults.forEach(([Ctor, id, priority]) => {
      const configured = this.configuration.getNormalizerOptions(id, { priority });
      if (this.registry.get(id)) return;
      this.registry.register(new Ctor({ id, ...configured }), { id, priority: configured.priority });
    });
    this.defaultNormalizersRegistered = true;
  }

  async normalize(rawUserInput, options = {}) {
    const rawText = typeof rawUserInput === 'string'
      ? rawUserInput
      : (rawUserInput?.rawText ?? rawUserInput?.text ?? '');
    const context = new NormalizationContext({
      rawUserInput,
      text: rawText,
      configuration: this.configuration,
      metadata: options.metadata || {}
    });
    if (!this.pipeline) {
      this.pipeline = new NormalizationPipeline({
        registry: this.registry,
        configuration: this.configuration,
        logger: this.logger
      });
    }
    const normalizedContext = await this.pipeline.run(context);
    return normalizedContext.toNormalizedInput();
  }

  register(normalizer, options = {}) {
    this.registry.register(normalizer, options);
    this.pipeline = null;
    return this;
  }

  listNormalizers() {
    return this.registry.list().map(normalizer => (typeof normalizer.describe === 'function'
      ? normalizer.describe()
      : { id: normalizer.id, priority: normalizer.priority, enabled: normalizer.enabled !== false }));
  }

  getStatus() {
    return {
      enabled: this.configuration.enabled,
      version: this.configuration.version,
      normalizerCount: this.registry.count(),
      normalizers: this.registry.health()
    };
  }

  destroy() {
    this.registry.list().forEach(normalizer => {
      if (typeof normalizer.destroy === 'function') normalizer.destroy();
    });
    this.registry.clear();
    this.pipeline = null;
  }
}

function createDefaultNormalizationManager(options = {}) {
  return new NormalizationManager(options);
}

module.exports = {
  NormalizationManager,
  createDefaultNormalizationManager
};
