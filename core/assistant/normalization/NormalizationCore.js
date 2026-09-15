'use strict';

const NormalizedInput = require('./NormalizedInput');
const { IdGenerator } = require('../utils');
const PipelineStage = require('../pipeline/PipelineStage');
const StageResult = require('../pipeline/StageResult');
const { CommandPreprocessorNormalizer } = require('./CommandPreprocessor');
const {
  AbbreviationExpander,
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

const idGenerator = new IdGenerator({ prefix: 'norm' });

const DEFAULT_NORMALIZER_OPTIONS = Object.freeze({
  enabled: true,
  priority: 100,
  strict: false,
  languages: ['*'],
  confidenceThreshold: 0.85,
  dictionaries: {},
  observationLimit: 100,
  rewriteText: false
});

const DEFAULT_CONFIGURATION = Object.freeze({
  enabled: true,
  version: '3.0.0',
  locale: 'en-US',
  strict: false,
  maxInputLength: 20000,
  maxHistoryEntries: 200,
  maxDiagnosticEntries: 300,
  maxObservationEntriesPerType: 100,
  normalizerTimeoutMs: 500,
  normalizers: {}
});

class NormalizationConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || DEFAULT_CONFIGURATION.version);
    this.locale = String(input.locale || DEFAULT_CONFIGURATION.locale);
    this.strict = input.strict === true;
    this.maxInputLength = Number.isFinite(input.maxInputLength)
      ? Math.max(1, Number(input.maxInputLength))
      : DEFAULT_CONFIGURATION.maxInputLength;
    this.maxHistoryEntries = Number.isFinite(input.maxHistoryEntries)
      ? Math.max(10, Number(input.maxHistoryEntries))
      : DEFAULT_CONFIGURATION.maxHistoryEntries;
    this.maxDiagnosticEntries = Number.isFinite(input.maxDiagnosticEntries)
      ? Math.max(10, Number(input.maxDiagnosticEntries))
      : DEFAULT_CONFIGURATION.maxDiagnosticEntries;
    this.maxObservationEntriesPerType = Number.isFinite(input.maxObservationEntriesPerType)
      ? Math.max(10, Number(input.maxObservationEntriesPerType))
      : DEFAULT_CONFIGURATION.maxObservationEntriesPerType;
    this.normalizerTimeoutMs = Number.isFinite(input.normalizerTimeoutMs)
      ? Math.max(10, Number(input.normalizerTimeoutMs))
      : DEFAULT_CONFIGURATION.normalizerTimeoutMs;
    this.normalizers = { ...(input.normalizers || {}) };
  }

  getNormalizerOptions(id, defaults = {}) {
    const configured = this.normalizers[String(id || '')] || {};
    return {
      ...DEFAULT_NORMALIZER_OPTIONS,
      ...(defaults || {}),
      ...(configured || {})
    };
  }

  isEnabled(id) {
    return this.enabled && this.getNormalizerOptions(id).enabled !== false;
  }

  toJSON() {
    return {
      enabled: this.enabled,
      version: this.version,
      locale: this.locale,
      strict: this.strict,
      maxInputLength: this.maxInputLength,
      maxHistoryEntries: this.maxHistoryEntries,
      maxDiagnosticEntries: this.maxDiagnosticEntries,
      maxObservationEntriesPerType: this.maxObservationEntriesPerType,
      normalizerTimeoutMs: this.normalizerTimeoutMs,
      normalizers: { ...this.normalizers }
    };
  }
}

function boundedPush(list, value, limit) {
  list.push(value);
  if (list.length > limit) list.splice(0, list.length - limit);
  return list;
}

class NormalizationContext {
  constructor({ rawUserInput = null, text = '', configuration = {}, metadata = {} } = {}) {
    const config = configuration instanceof NormalizationConfiguration
      ? configuration
      : new NormalizationConfiguration(configuration);
    const rawText = String(rawUserInput?.rawText ?? rawUserInput?.text ?? text ?? '');
    this.rawUserInput = rawUserInput || null;
    this.requestId = String(rawUserInput?.requestId || idGenerator.next('request'));
    this.conversationId = String(rawUserInput?.conversationId || '');
    this.language = rawUserInput?.language ? { ...rawUserInput.language } : null;
    this.locale = String(rawUserInput?.metadata?.locale || rawUserInput?.options?.locale || config.locale);
    this.originalText = rawText;
    this.workingText = rawText;
    this.normalizationHistory = [];
    this.diagnostics = [];
    this.warnings = [];
    this.metadata = {
      ...(metadata || {}),
      source: rawUserInput?.source || 'chat',
      observations: {
        emojis: [],
        numbers: [],
        dates: [],
        times: [],
        units: [],
        languageSegments: []
      }
    };
    this.timing = {
      startedAt: Date.now(),
      finishedAt: null,
      durationMs: 0,
      normalizers: []
    };
    this.configuration = config;
    this.futureExtensions = {};
    this.confidence = Math.max(0, Math.min(1, Number(rawUserInput?.confidence ?? 1)));
  }

  setText(nextText, normalizerId, details = {}) {
    const previous = this.workingText;
    const next = String(nextText ?? '');
    this.workingText = next;
    const changed = previous !== next;
    boundedPush(this.normalizationHistory, {
      normalizerId: String(normalizerId || 'unknown'),
      changed,
      beforeLength: previous.length,
      afterLength: next.length,
      modifiedCharacters: changed ? Math.abs(previous.length - next.length) : 0,
      details: { ...(details || {}) },
      timestamp: Date.now()
    }, this.configuration.maxHistoryEntries);
    return this;
  }

  addObservation(type, value) {
    const key = String(type || '');
    if (!Array.isArray(this.metadata.observations[key])) {
      this.metadata.observations[key] = [];
    }
    boundedPush(this.metadata.observations[key], value, this.configuration.maxObservationEntriesPerType);
    return this;
  }

  addWarning(message, data = {}) {
    boundedPush(this.warnings, { message: String(message || ''), data: { ...(data || {}) }, timestamp: Date.now() }, this.configuration.maxDiagnosticEntries);
    return this;
  }

  addDiagnostic(record = {}) {
    boundedPush(this.diagnostics, {
      level: String(record.level || 'info'),
      message: String(record.message || ''),
      normalizerId: String(record.normalizerId || ''),
      data: { ...(record.data || {}) },
      timestamp: Date.now()
    }, this.configuration.maxDiagnosticEntries);
    return this;
  }

  setCommandIntent(text, details = {}) {
    const intentText = String(text || '').trim();
    this.metadata.commandIntentText = intentText;
    this.futureExtensions.command = {
      ...(this.futureExtensions.command || {}),
      intentText,
      ...(details || {})
    };
    return this;
  }

  getText() {
    return String(this.workingText || '');
  }

  recordTiming(normalizerId, durationMs, success = true) {
    this.timing.normalizers.push({
      normalizerId: String(normalizerId || ''),
      durationMs: Math.max(0, Number(durationMs) || 0),
      success: success === true
    });
    return this;
  }

  toNormalizedInput() {
    this.timing.finishedAt = Date.now();
    this.timing.durationMs = Math.max(0, this.timing.finishedAt - this.timing.startedAt);
    return new NormalizedInput({
      originalInput: this.rawUserInput,
      originalText: this.originalText,
      normalizedText: this.workingText,
      language: this.language,
      locale: this.locale,
      normalizationHistory: this.normalizationHistory,
      warnings: this.warnings,
      diagnostics: this.diagnostics,
      metadata: this.metadata,
      timing: this.timing,
      confidence: this.confidence,
      normalizationVersion: this.configuration.version,
      futureExtensions: this.futureExtensions
    });
  }
}

class NormalizationDiagnostics {
  constructor(options = {}) {
    this.records = [];
    this.maxRecords = Math.max(50, Number(options.maxRecords) || 500);
  }

  record(record = {}) {
    const entry = {
      level: String(record.level || 'info'),
      message: String(record.message || ''),
      normalizerId: String(record.normalizerId || ''),
      data: { ...(record.data || {}) },
      timestamp: Date.now()
    };
    this.records.push(entry);
    this.records = this.records.slice(-this.maxRecords);
    return entry;
  }

  list(limit = 100) {
    return this.records.slice(-Math.max(1, Number(limit) || 100));
  }

  clear() {
    const count = this.records.length;
    this.records = [];
    return count;
  }

  countByLevel() {
    return this.records.reduce((summary, record) => {
      summary[record.level] = (summary[record.level] || 0) + 1;
      return summary;
    }, {});
  }

  snapshot(limit = 100) {
    return {
      total: this.records.length,
      byLevel: this.countByLevel(),
      records: this.list(limit)
    };
  }
}

class NormalizationError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = { ...(context || {}) };
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: { ...this.context }
    };
  }
}

class InvalidUnicodeError extends NormalizationError {}
class SpellRepairError extends NormalizationError {}
class LanguageDetectionError extends NormalizationError {}
class ConfigurationError extends NormalizationError {}
class NormalizerExecutionError extends NormalizationError {}
class NormalizerTimeoutError extends NormalizationError {}

class NormalizationLogger {
  constructor(logger = null) {
    this.logger = logger || null;
  }

  _safeData(data = {}) {
    const payload = { ...(data || {}) };
    if (typeof payload.text === 'string' && payload.text.length > 160) payload.text = `${payload.text.slice(0, 160)}...`;
    if (typeof payload.input === 'string' && payload.input.length > 160) payload.input = `${payload.input.slice(0, 160)}...`;
    return payload;
  }

  info(message, data = {}) {
    if (typeof this.logger?.info === 'function') this.logger.info(`[Normalization] ${message}`, this._safeData(data));
  }

  warn(message, data = {}) {
    if (typeof this.logger?.warn === 'function') this.logger.warn(`[Normalization] ${message}`, this._safeData(data));
  }

  error(message, data = {}) {
    if (typeof this.logger?.error === 'function') this.logger.error(`[Normalization] ${message}`, this._safeData(data));
  }
}

class NormalizerRegistry {
  constructor() {
    this.normalizers = new Map();
  }

  register(normalizer, options = {}) {
    if (!normalizer || typeof normalizer.normalize !== 'function') {
      throw new ConfigurationError('Normalizer must provide normalize(context).');
    }
    const id = String(options.id || normalizer.id || normalizer.name || normalizer.constructor?.name || '').trim();
    if (!id) throw new ConfigurationError('Normalizer id is required.');
    if (this.normalizers.has(id) && options.replace !== true) {
      throw new ConfigurationError(`Normalizer already registered: ${id}`);
    }
    normalizer.id = id;
    if (Number.isFinite(options.priority)) normalizer.priority = Number(options.priority);
    if (options.enabled !== undefined) normalizer.enabled = options.enabled !== false;
    this.normalizers.set(id, normalizer);
    return this;
  }

  registerAll(normalizers = []) {
    for (const item of normalizers) {
      if (Array.isArray(item)) this.register(item[0], item[1] || {});
      else this.register(item);
    }
    return this;
  }

  unregister(id) {
    return this.normalizers.delete(String(id || '').trim());
  }

  get(id) {
    return this.normalizers.get(String(id || '').trim()) || null;
  }

  has(id) {
    return this.normalizers.has(String(id || '').trim());
  }

  list({ includeDisabled = true } = {}) {
    return [...this.normalizers.values()]
      .filter(normalizer => includeDisabled || normalizer.enabled !== false)
      .sort((left, right) => {
        const priority = (Number(left.priority) || 0) - (Number(right.priority) || 0);
        return priority || String(left.id).localeCompare(String(right.id));
      });
  }

  health() {
    return this.list().map(normalizer => ({
      id: normalizer.id,
      version: normalizer.version,
      priority: normalizer.priority,
      enabled: normalizer.enabled !== false,
      initialized: normalizer.initialized === true
    }));
  }

  clear() {
    const count = this.normalizers.size;
    this.normalizers.clear();
    return count;
  }

  count() {
    return this.normalizers.size;
  }
}

class NormalizationPipeline {
  constructor({ registry, configuration, diagnostics = null, logger = null } = {}) {
    this.registry = registry;
    this.configuration = configuration;
    this.diagnostics = diagnostics || new NormalizationDiagnostics();
    this.logger = logger instanceof NormalizationLogger ? logger : new NormalizationLogger(logger);
  }

  async _runNormalizer(normalizer, context) {
    const timeoutMs = Math.max(10, Number(this.configuration.normalizerTimeoutMs) || 500);
    let timeoutId = null;
    const operation = Promise.resolve().then(() => normalizer.normalize(context));
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new NormalizerTimeoutError('Normalizer timed out.', {
        normalizerId: normalizer.id,
        timeoutMs
      })), timeoutMs);
    });
    try {
      return await Promise.race([operation, timeout]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  async run(context) {
    if (!this.configuration.enabled) {
      context.addDiagnostic({ level: 'info', message: 'Normalization disabled by configuration.' });
      return context;
    }

    const normalizers = this.registry.list({ includeDisabled: false });
    for (const normalizer of normalizers) {
      const startedAt = Date.now();
      try {
        if (!this.configuration.isEnabled(normalizer.id)) continue;
        if (!normalizer.initialized && typeof normalizer.initialize === 'function') {
          await normalizer.initialize();
        }
        if (typeof normalizer.supports === 'function' && !normalizer.supports(context)) {
          continue;
        }
        if (typeof normalizer.validate === 'function') {
          await normalizer.validate(context);
        }
        const nextContext = await this._runNormalizer(normalizer, context);
        if (nextContext) context = nextContext;
        if (typeof normalizer.markRun === 'function') normalizer.markRun(true);
        context.recordTiming(normalizer.id, Date.now() - startedAt, true);
      } catch (error) {
        const wrapped = error instanceof NormalizerExecutionError || error instanceof NormalizerTimeoutError
          ? error
          : new NormalizerExecutionError(error.message || 'Normalizer failed.', { normalizerId: normalizer.id, cause: error });
        context.recordTiming(normalizer.id, Date.now() - startedAt, false);
        if (typeof normalizer.markRun === 'function') normalizer.markRun(false);
        context.addWarning('Normalizer failed; continuing with current text.', { normalizerId: normalizer.id });
        context.addDiagnostic({ level: 'warn', message: wrapped.message, normalizerId: normalizer.id });
        this.diagnostics.record({ level: 'warn', message: wrapped.message, normalizerId: normalizer.id });
        if (this.configuration.strict) throw wrapped;
      } finally {
        if (typeof normalizer.cleanup === 'function') {
          await normalizer.cleanup(context);
        }
      }
    }
    return context;
  }
}

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

class LanguageNormalizationStage extends PipelineStage {
  constructor(options = {}) {
    super({
      id: options.id || 'assistant.language.normalization',
      name: options.name || 'Assistant Language Normalization',
      order: Number.isFinite(options.order) ? options.order : -100,
      enabled: options.enabled !== false
    });
    this.manager = options.manager || createDefaultNormalizationManager({
      configuration: options.configuration || {},
      logger: options.logger || null
    });
  }

  async execute(context) {
    const rawUserInput = context.rawUserInput || {
      rawText: context.rawInput,
      source: context.source,
      requestId: context.requestId,
      conversationId: context.conversationId,
      metadata: context.metadata,
      options: context.options
    };
    const normalizedInput = await this.manager.normalize(rawUserInput, { metadata: context.metadata });
    const commandIntentText = String(normalizedInput.commandIntentText || normalizedInput.metadata?.commandIntentText || '').trim();
    context.normalizedInput = normalizedInput.normalizedText;
    context.commandIntentText = commandIntentText || normalizedInput.normalizedText;
    context.normalizedInputObject = normalizedInput;
    context.set('assistant.commandIntentText', commandIntentText || normalizedInput.normalizedText);
    context.set('assistant.normalizedInput', normalizedInput);
    context.set('assistant.normalizationObservations', normalizedInput.metadata?.observations || {});
    return StageResult.ok(this.id, {
      input: normalizedInput.normalizedText,
      source: context.source,
      options: { ...(context.options || {}) },
      normalizedInput: {
        normalizedText: normalizedInput.normalizedText,
        commandIntentText,
        commandTokens: normalizedInput.commandTokens,
        normalizationVersion: normalizedInput.normalizationVersion,
        historyCount: normalizedInput.normalizationHistory.length
      }
    });
  }

  async destroy() {
    if (typeof this.manager?.destroy === 'function') this.manager.destroy();
    return super.destroy();
  }
}

function createDefaultNormalizationManager(options = {}) {
  return new NormalizationManager(options);
}

module.exports = {
  NormalizationConfiguration,
  NormalizationContext,
  NormalizationDiagnostics,
  NormalizerRegistry,
  NormalizationPipeline,
  NormalizationManager,
  NormalizationLogger,
  LanguageNormalizationStage,
  createDefaultNormalizationManager,
  NormalizationError,
  InvalidUnicodeError,
  SpellRepairError,
  LanguageDetectionError,
  ConfigurationError,
  NormalizerExecutionError,
  NormalizerTimeoutError
};

NormalizationConfiguration.DEFAULT_CONFIGURATION = DEFAULT_CONFIGURATION;
NormalizationConfiguration.DEFAULT_NORMALIZER_OPTIONS = DEFAULT_NORMALIZER_OPTIONS;