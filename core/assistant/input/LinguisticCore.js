'use strict';

const { IdGenerator, deepFreeze } = require('../shared/UtilsCore');
const PipelineStage = require('../pipeline/PipelineStage');
const StageResult = require('../pipeline/StageResult');
const NormalizedInput = require('./NormalizedInput');
const {
  Tokenizer,
  SentenceSplitter,
  ClauseAnalyzer,
  DependencyParser,
  POSTagger,
  VerbDetector,
  SubjectDetector,
  ObjectDetector,
  ModifierDetector,
  QuestionDetector,
  NegationDetector,
  PronounResolver
} = require('./LinguisticAnalyzers');

class LinguisticError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = { ...(context || {}) };
    this.code = context.code || this.constructor.name;
    this.timestamp = Date.now();
    if (context.cause) this.cause = context.cause;
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp
    };
  }
}

class TokenizerError extends LinguisticError {}
class SentenceSplitError extends LinguisticError {}
class DependencyParseError extends LinguisticError {}
class POSTaggingError extends LinguisticError {}
class PronounResolutionError extends LinguisticError {}
class ConfigurationError extends LinguisticError {}
class AnalyzerExecutionError extends LinguisticError {}

const LinguisticErrors = {
  LinguisticError,
  TokenizerError,
  SentenceSplitError,
  DependencyParseError,
  POSTaggingError,
  PronounResolutionError,
  ConfigurationError,
  AnalyzerExecutionError
};

class AnalyzerRegistry {
  constructor() {
    this.analyzers = new Map();
  }

  register(analyzer, options = {}) {
    if (!analyzer || typeof analyzer.analyze !== 'function') {
      throw new ConfigurationError('Analyzer must provide analyze(context).');
    }
    const id = String(options.id || analyzer.id || analyzer.name || analyzer.constructor?.name || '').trim();
    if (!id) throw new ConfigurationError('Analyzer id is required.');
    analyzer.id = id;
    if (Number.isFinite(options.priority)) analyzer.priority = Number(options.priority);
    if (options.enabled !== undefined) analyzer.enabled = options.enabled !== false;
    this.analyzers.set(id, analyzer);
    return this;
  }

  unregister(id) {
    return this.analyzers.delete(String(id || '').trim());
  }

  get(id) {
    return this.analyzers.get(String(id || '').trim()) || null;
  }

  list({ includeDisabled = true } = {}) {
    return [...this.analyzers.values()]
      .filter(analyzer => includeDisabled || analyzer.enabled !== false)
      .sort((left, right) => {
        const priority = (Number(left.priority) || 0) - (Number(right.priority) || 0);
        return priority || String(left.id).localeCompare(String(right.id));
      });
  }

  health() {
    return this.list().map(analyzer => ({
      id: analyzer.id,
      version: analyzer.version,
      priority: analyzer.priority,
      enabled: analyzer.enabled !== false,
      initialized: analyzer.initialized === true
    }));
  }

  count({ includeDisabled = true } = {}) {
    return this.list({ includeDisabled }).length;
  }

  clear() {
    const count = this.analyzers.size;
    this.analyzers.clear();
    return count;
  }
}

const DEFAULT_CONFIGURATION = Object.freeze({
  enabled: true,
  version: '4.0.0',
  locale: 'en-US',
  strict: false,
  analyzers: {}
});

const DEFAULT_ANALYZER_OPTIONS = Object.freeze({
  enabled: true,
  priority: 100,
  strict: false,
  languages: ['*'],
  confidenceThreshold: 0.6,
  grammarRules: {}
});

class LinguisticConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || DEFAULT_CONFIGURATION.version);
    this.locale = String(input.locale || DEFAULT_CONFIGURATION.locale);
    this.strict = input.strict === true;
    this.maxTokens = Number.isFinite(input.maxTokens) ? Math.max(1, Number(input.maxTokens)) : 512;
    this.maxClauses = Number.isFinite(input.maxClauses) ? Math.max(1, Number(input.maxClauses)) : 32;
    this.preserveCommandTargets = input.preserveCommandTargets !== false;
    this.analyzers = { ...(input.analyzers || {}) };
  }

  getAnalyzerOptions(id, defaults = {}) {
    return {
      ...DEFAULT_ANALYZER_OPTIONS,
      ...(defaults || {}),
      ...(this.analyzers[String(id || '')] || {})
    };
  }

  isEnabled(id) {
    return this.enabled && this.getAnalyzerOptions(id).enabled !== false;
  }

  toJSON() {
    return {
      enabled: this.enabled,
      version: this.version,
      locale: this.locale,
      strict: this.strict,
      maxTokens: this.maxTokens,
      maxClauses: this.maxClauses,
      preserveCommandTargets: this.preserveCommandTargets,
      analyzers: { ...this.analyzers }
    };
  }
}

const idGenerator = new IdGenerator({ prefix: 'ling' });

class LinguisticContext {
  constructor({ normalizedInput = null, text = '', configuration = {}, metadata = {} } = {}) {
    const config = configuration instanceof LinguisticConfiguration
      ? configuration
      : new LinguisticConfiguration(configuration);
    const normalizedText = String(normalizedInput?.normalizedText ?? text ?? '');
    this.normalizedInput = normalizedInput || null;
    this.requestId = String(normalizedInput?.originalInput?.requestId || idGenerator.next('request'));
    this.conversationId = String(normalizedInput?.originalInput?.conversationId || '');
    this.originalSentence = String(normalizedInput?.originalText ?? normalizedText);
    this.normalizedSentence = normalizedText;
    this.language = normalizedInput?.language ? { ...normalizedInput.language } : null;
    this.locale = String(normalizedInput?.locale || config.locale);
    this.tokens = [];
    this.sentences = [];
    this.clauses = [];
    this.dependencies = [];
    this.posTags = [];
    this.subjects = [];
    this.verbs = [];
    this.objects = [];
    this.modifiers = [];
    this.negations = [];
    this.pronouns = [];
    this.questions = [];
    this.grammaticalRelationships = [];
    this.diagnostics = [];
    this.warnings = [];
    this.metadata = { ...(metadata || {}) };
    this.configuration = config;
    this.futureExtensions = {};
    this.confidence = Math.max(0, Math.min(1, Number(normalizedInput?.confidence ?? 1)));
    this.timing = {
      startedAt: Date.now(),
      finishedAt: null,
      durationMs: 0,
      analyzers: []
    };
  }

  addDiagnostic(record = {}) {
    this.diagnostics.push({
      level: String(record.level || 'info'),
      message: String(record.message || ''),
      analyzerId: String(record.analyzerId || ''),
      data: { ...(record.data || {}) },
      timestamp: Date.now()
    });
    return this;
  }

  addWarning(message, data = {}) {
    this.warnings.push({ message: String(message || ''), data: { ...(data || {}) }, timestamp: Date.now() });
    return this;
  }

  recordTiming(analyzerId, durationMs, success = true) {
    this.timing.analyzers.push({
      analyzerId: String(analyzerId || ''),
      durationMs: Math.max(0, Number(durationMs) || 0),
      success: success === true
    });
    return this;
  }

  summary() {
    return {
      tokenCount: this.tokens.length,
      sentenceCount: this.sentences.length,
      clauseCount: this.clauses.length,
      dependencyCount: this.dependencies.length,
      questionCount: this.questions.length,
      negationCount: this.negations.length,
      pronounCount: this.pronouns.length
    };
  }

  compact() {
    const uniqueBy = (items, keyFn) => {
      const seen = new Set();
      return (items || []).filter(item => {
        const key = keyFn(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };
    this.dependencies = uniqueBy(this.dependencies, item => `${item.governor}:${item.dependent}:${item.relation}`);
    this.grammaticalRelationships = uniqueBy(this.grammaticalRelationships, item => `${item.type}:${item.from}:${item.to}`);
    this.clauses = this.clauses.slice(0, this.configuration.maxClauses || 32);
    return this;
  }

  toGraph() {
    this.compact();
    this.timing.finishedAt = Date.now();
    this.timing.durationMs = Math.max(0, this.timing.finishedAt - this.timing.startedAt);
    return new LinguisticGraph({
      originalSentence: this.originalSentence,
      normalizedSentence: this.normalizedSentence,
      tokens: this.tokens,
      sentences: this.sentences,
      clauses: this.clauses,
      dependencies: this.dependencies,
      posTags: this.posTags,
      subjects: this.subjects,
      verbs: this.verbs,
      objects: this.objects,
      modifiers: this.modifiers,
      negations: this.negations,
      pronouns: this.pronouns,
      questions: this.questions,
      grammaticalRelationships: this.grammaticalRelationships,
      diagnostics: this.diagnostics.concat(this.warnings.map(warning => ({ level: 'warn', message: warning.message, data: warning.data, timestamp: warning.timestamp }))),
      summary: this.summary(),
      confidence: this.confidence,
      timing: this.timing,
      futureExtensions: this.futureExtensions,
      linguisticVersion: this.configuration.version
    });
  }
}

class LinguisticDiagnostics {
  constructor() {
    this.records = [];
    this.startedAt = Date.now();
    this.finishedAt = null;
  }

  record(record = {}) {
    const entry = {
      level: String(record.level || 'info'),
      message: String(record.message || ''),
      analyzerId: String(record.analyzerId || ''),
      data: { ...(record.data || {}) },
      timestamp: Date.now()
    };
    this.records.push(entry);
    this.records = this.records.slice(-500);
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

  finish() {
    this.finishedAt = Date.now();
    return this;
  }

  toJSON(limit = 100) {
    this.finish();
    return {
      records: this.list(limit),
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      durationMs: Math.max(0, (this.finishedAt || Date.now()) - this.startedAt)
    };
  }
}

class LinguisticGraph {
  constructor({
    originalSentence = '',
    normalizedSentence = '',
    tokens = [],
    sentences = [],
    clauses = [],
    dependencies = [],
    posTags = [],
    subjects = [],
    verbs = [],
    objects = [],
    modifiers = [],
    negations = [],
    pronouns = [],
    questions = [],
    grammaticalRelationships = [],
    diagnostics = [],
    summary = {},
    confidence = 1,
    timing = {},
    futureExtensions = {},
    linguisticVersion = '4.0.0'
  } = {}) {
    this.originalSentence = String(originalSentence || '');
    this.normalizedSentence = String(normalizedSentence || '');
    this.tokens = Array.isArray(tokens) ? tokens.slice() : [];
    this.sentences = Array.isArray(sentences) ? sentences.slice() : [];
    this.clauses = Array.isArray(clauses) ? clauses.slice() : [];
    this.dependencies = Array.isArray(dependencies) ? dependencies.slice() : [];
    this.posTags = Array.isArray(posTags) ? posTags.slice() : [];
    this.subjects = Array.isArray(subjects) ? subjects.slice() : [];
    this.verbs = Array.isArray(verbs) ? verbs.slice() : [];
    this.objects = Array.isArray(objects) ? objects.slice() : [];
    this.modifiers = Array.isArray(modifiers) ? modifiers.slice() : [];
    this.negations = Array.isArray(negations) ? negations.slice() : [];
    this.pronouns = Array.isArray(pronouns) ? pronouns.slice() : [];
    this.questions = Array.isArray(questions) ? questions.slice() : [];
    this.grammaticalRelationships = Array.isArray(grammaticalRelationships) ? grammaticalRelationships.slice() : [];
    this.diagnostics = Array.isArray(diagnostics) ? diagnostics.slice() : [];
    this.summary = { ...(summary || {}) };
    this.confidence = Math.max(0, Math.min(1, Number(confidence) || 0));
    this.timing = { ...(timing || {}) };
    this.futureExtensions = { ...(futureExtensions || {}) };
    this.linguisticVersion = String(linguisticVersion || '4.0.0');
    deepFreeze(this);
  }
}

class LinguisticLogger {
  constructor(logger = null) {
    this.logger = logger || null;
  }

  _safeData(data) {
    if (!data || typeof data !== 'object') return data;
    const copy = { ...data };
    for (const key of Object.keys(copy)) {
      if (/(password|token|secret|key|email|phone)/i.test(key)) copy[key] = '[REDACTED]';
    }
    return copy;
  }

  info(message, data = {}) {
    if (typeof this.logger?.info === 'function') this.logger.info(`[Linguistic] ${message}`, this._safeData(data));
  }

  warn(message, data = {}) {
    if (typeof this.logger?.warn === 'function') this.logger.warn(`[Linguistic] ${message}`, this._safeData(data));
  }

  error(message, data = {}) {
    if (typeof this.logger?.error === 'function') this.logger.error(`[Linguistic] ${message}`, this._safeData(data));
  }
}

class LinguisticPipeline {
  constructor({ registry, configuration, diagnostics = null, logger = null } = {}) {
    this.registry = registry;
    this.configuration = configuration;
    this.diagnostics = diagnostics || new LinguisticDiagnostics();
    this.logger = logger instanceof LinguisticLogger ? logger : new LinguisticLogger(logger);
  }

  async run(context) {
    if (!this.configuration.enabled) return context;
    const analyzers = this.registry.list({ includeDisabled: false });
    for (const analyzer of analyzers) {
      const startedAt = Date.now();
      try {
        if (!this.configuration.isEnabled(analyzer.id)) continue;
        if (!analyzer.initialized && typeof analyzer.initialize === 'function') await analyzer.initialize();
        if (typeof analyzer.supports === 'function' && !analyzer.supports(context)) continue;
        if (typeof analyzer.validate === 'function') await analyzer.validate(context);
        const nextContext = await analyzer.analyze(context);
        if (nextContext) context = nextContext;
        if (typeof context.compact === 'function' && ['linguistic.dependencyParser', 'linguistic.clauseAnalyzer'].includes(analyzer.id)) {
          context.compact();
        }
        context.recordTiming(analyzer.id, Date.now() - startedAt, true);
      } catch (error) {
        const wrapped = error instanceof AnalyzerExecutionError
          ? error
          : new AnalyzerExecutionError(error.message || 'Analyzer failed.', { analyzerId: analyzer.id, cause: error });
        context.recordTiming(analyzer.id, Date.now() - startedAt, false);
        context.addWarning('Analyzer failed; continuing with current graph.', { analyzerId: analyzer.id });
        context.addDiagnostic({ level: 'warn', message: wrapped.message, analyzerId: analyzer.id });
        this.diagnostics.record({ level: 'warn', message: wrapped.message, analyzerId: analyzer.id });
        if (this.configuration.strict) throw wrapped;
      } finally {
        if (typeof analyzer.cleanup === 'function') await analyzer.cleanup(context);
      }
    }
    this.diagnostics.finish();
    return context;
  }
}

class LinguisticManager {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof LinguisticConfiguration
      ? options.configuration
      : new LinguisticConfiguration(options.configuration || options);
    this.registry = options.registry || new AnalyzerRegistry();
    this.pipeline = options.pipeline || null;
    this.logger = options.logger || null;
    if (options.defaultAnalyzers !== false) this._registerDefaults();
  }

  _registerDefaults() {
    const defaults = [
      [Tokenizer, 'linguistic.tokenizer', 10],
      [SentenceSplitter, 'linguistic.sentenceSplitter', 20],
      [ClauseAnalyzer, 'linguistic.clauseAnalyzer', 30],
      [DependencyParser, 'linguistic.dependencyParser', 40],
      [POSTagger, 'linguistic.posTagger', 50],
      [VerbDetector, 'linguistic.verbDetector', 60],
      [SubjectDetector, 'linguistic.subjectDetector', 70],
      [ObjectDetector, 'linguistic.objectDetector', 80],
      [ModifierDetector, 'linguistic.modifierDetector', 90],
      [QuestionDetector, 'linguistic.questionDetector', 100],
      [NegationDetector, 'linguistic.negationDetector', 110],
      [PronounResolver, 'linguistic.pronounResolver', 120]
    ];
    defaults.forEach(([Ctor, id, priority]) => {
      const configured = this.configuration.getAnalyzerOptions(id, { priority });
      this.registry.register(new Ctor({ id, ...configured }), { id, priority: configured.priority, enabled: configured.enabled });
    });
  }

  async analyze(normalizedInput, options = {}) {
    const context = new LinguisticContext({
      normalizedInput,
      text: normalizedInput?.normalizedText || '',
      configuration: this.configuration,
      metadata: options.metadata || {}
    });
    if (!this.pipeline) {
      this.pipeline = new LinguisticPipeline({
        registry: this.registry,
        configuration: this.configuration,
        logger: this.logger
      });
    }
    const linguisticContext = await this.pipeline.run(context);
    return linguisticContext.toGraph();
  }

  getStatus() {
    return {
      enabled: this.configuration.enabled,
      version: this.configuration.version,
      pipelineReady: Boolean(this.pipeline),
      analyzerCount: this.registry.count(),
      analyzers: this.registry.health()
    };
  }

  destroy() {
    this.registry.list().forEach(analyzer => {
      if (typeof analyzer.destroy === 'function') analyzer.destroy();
    });
    this.registry.clear();
    this.pipeline = null;
  }
}

function createDefaultLinguisticManager(options = {}) {
  return new LinguisticManager(options);
}

class LinguisticUnderstandingStage extends PipelineStage {
  constructor(options = {}) {
    super({
      id: options.id || 'assistant.linguistic.understanding',
      name: options.name || 'Assistant Linguistic Understanding',
      order: Number.isFinite(options.order) ? options.order : -50,
      enabled: options.enabled !== false
    });
    this.manager = options.manager || createDefaultLinguisticManager({
      configuration: options.configuration || {},
      logger: options.logger || null
    });
  }

  async execute(context) {
    const normalizedInput = context.normalizedInputObject || new NormalizedInput({
      originalInput: context.rawUserInput,
      originalText: context.rawInput,
      normalizedText: context.normalizedInput || context.rawInput,
      language: context.rawUserInput?.language || null,
      locale: context.rawUserInput?.metadata?.locale || 'en-US'
    });
    const linguisticGraph = await this.manager.analyze(normalizedInput, { metadata: context.metadata });
    context.linguisticGraph = linguisticGraph;
    context.set('assistant.linguisticGraph', linguisticGraph);
    return StageResult.ok(this.id, {
      input: normalizedInput.normalizedText,
      source: context.source,
      options: { ...(context.options || {}) },
      linguisticGraph: {
        tokenCount: linguisticGraph.tokens.length,
        sentenceCount: linguisticGraph.sentences.length,
        clauseCount: linguisticGraph.clauses.length,
        dependencyCount: linguisticGraph.dependencies.length,
        questionCount: linguisticGraph.summary?.questionCount || 0,
        pronounCount: linguisticGraph.summary?.pronounCount || 0,
        linguisticVersion: linguisticGraph.linguisticVersion
      }
    });
  }

  async destroy() {
    if (typeof this.manager?.destroy === 'function') this.manager.destroy();
    return super.destroy();
  }
}

module.exports = {
  AnalyzerRegistry,
  BaseAnalyzer: require('./LinguisticAnalyzers').BaseAnalyzer,
  LinguisticConfiguration,
  LinguisticContext,
  LinguisticDiagnostics,
  LinguisticErrors,
  LinguisticGraph,
  LinguisticLogger,
  LinguisticManager,
  LinguisticPipeline,
  LinguisticUnderstandingStage,
  createDefaultLinguisticManager,
  ...LinguisticErrors
};