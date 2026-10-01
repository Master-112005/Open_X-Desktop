'use strict';

const PipelineEventDispatcher = require('../shared/PipelineEventDispatcher');
const { ServiceContainer, PerformanceTracker, deepFreeze, IdGenerator, Stopwatch, withTimeout, serializeError, normalizeError, safeLogger } = require('../shared/UtilsCore');
const StageResult = require('./StageResult');
const {
  CancellationError,
  ConfigurationError,
  StageExecutionError,
  StageTimeoutError,
  TimeoutError
} = require('./PipelineError');

const { LanguageNormalizationStage } = require('../input');
const { LinguisticUnderstandingStage } = require('../input');
const { SemanticUnderstandingStage } = require('../understanding');
const { EntityUnderstandingStage } = require('../understanding/index.js');
const { MemoryContextStage } = require('../knowledge/index.js');
const { GoalIntentReasoningStage } = require('../reasoning/index.js');
const { TaskPlanningStage } = require('../reasoning/index.js');
const { AssistantExecutionStage, DecisionValidationAutomationStage } = require('../automation/index.js');
const { VerificationResponseStage } = require('../respond/index.js');

const PIPELINE_LAYER_VERSION = '1.1.0';

const PipelineEvents = Object.freeze({
  ...require('../shared/PipelineEvents'),
  PIPELINE_EVENTS_BRIDGE_VERSION: '1.1.0'
});

const idGenerator = new IdGenerator({ prefix: 'pipe' });

const DEFAULT_LIMITS = Object.freeze({
  diagnostics: 500,
  stageTimings: 100,
  sharedEntries: 200
});

function pushBounded(list, value, limit) {
  list.push(value);
  if (list.length > limit) list.splice(0, list.length - limit);
  return list;
}

class PipelineConfiguration {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(0, Number(options.timeoutMs)) : 0;
    this.stageTimeoutMs = Number.isFinite(options.stageTimeoutMs) ? Math.max(0, Number(options.stageTimeoutMs)) : 0;
    this.continueOnStageFailure = options.continueOnStageFailure === true;
    this.collectDiagnostics = options.collectDiagnostics !== false;
    this.collectStageOutputs = options.collectStageOutputs !== false;
    this.maxDiagnostics = Number.isFinite(options.maxDiagnostics) ? Math.max(25, Number(options.maxDiagnostics)) : 500;
    this.maxStageTimings = Number.isFinite(options.maxStageTimings) ? Math.max(10, Number(options.maxStageTimings)) : 100;
    this.maxSharedEntries = Number.isFinite(options.maxSharedEntries) ? Math.max(10, Number(options.maxSharedEntries)) : 200;
    this.stageOptions = { ...(options.stageOptions || {}) };
    this.stages = Array.isArray(options.stages) ? options.stages.slice() : [];
    this.metadata = { ...(options.metadata || {}) };
    Object.freeze(this.stageOptions);
    Object.freeze(this.stages);
    Object.freeze(this.metadata);
    Object.freeze(this);
  }

  optionsForStage(stageId) {
    return { ...(this.stageOptions[String(stageId || '')] || {}) };
  }

  toJSON() {
    return {
      enabled: this.enabled,
      timeoutMs: this.timeoutMs,
      stageTimeoutMs: this.stageTimeoutMs,
      continueOnStageFailure: this.continueOnStageFailure,
      collectDiagnostics: this.collectDiagnostics,
      collectStageOutputs: this.collectStageOutputs,
      maxDiagnostics: this.maxDiagnostics,
      maxStageTimings: this.maxStageTimings,
      maxSharedEntries: this.maxSharedEntries,
      stageOptions: this.stageOptions,
      stages: this.stages,
      metadata: this.metadata
    };
  }
}

class PipelineContext {
  constructor({ requestId = '', conversationId = '', source = 'chat', rawInput = '', normalizedInput = '', options = {}, metadata = {}, rawUserInput = null } = {}) {
    this.rawUserInput = rawUserInput || null;
    this.requestId = requestId || rawUserInput?.requestId || idGenerator.next('request');
    this.conversationId = conversationId || rawUserInput?.conversationId || '';
    this.timestamp = Date.now();
    this.source = String(source || rawUserInput?.source || 'chat');
    this.rawInput = String(rawInput || rawUserInput?.rawText || '');
    this.normalizedInput = String(normalizedInput || rawInput || rawUserInput?.rawText || '');
    this.normalizedInputObject = null;
    this.linguisticGraph = null;
    this.semanticRepresentation = null;
    this.options = { ...(options || {}) };
    this.metadata = { ...(metadata || {}) };
    this.limits = {
      diagnostics: Math.max(25, Number(this.options.pipelineMaxDiagnostics || this.metadata.pipelineMaxDiagnostics) || DEFAULT_LIMITS.diagnostics),
      stageTimings: Math.max(10, Number(this.options.pipelineMaxStageTimings || this.metadata.pipelineMaxStageTimings) || DEFAULT_LIMITS.stageTimings),
      sharedEntries: Math.max(10, Number(this.options.pipelineMaxSharedEntries || this.metadata.pipelineMaxSharedEntries) || DEFAULT_LIMITS.sharedEntries)
    };
    this.diagnostics = [];
    this.shared = new Map();
    this.stageOutputs = new Map();
    this.timing = {
      startedAt: this.timestamp,
      finishedAt: null,
      durationMs: 0,
      stages: []
    };
    this.cancelled = false;
    this.cancelReason = '';
    this.input = deepFreeze({
      requestId: this.requestId,
      conversationId: this.conversationId,
      source: this.source,
      rawInput: this.rawInput,
      normalizedInput: this.normalizedInput,
      options: { ...this.options },
      metadata: { ...this.metadata },
      rawUserInput
    });
  }

  set(key, value) {
    const normalizedKey = String(key);
    if (this.shared.size >= this.limits.sharedEntries && !this.shared.has(normalizedKey)) {
      const removableKey = [...this.shared.keys()].find(item => !String(item).startsWith('assistant.'))
        || this.shared.keys().next().value;
      this.shared.delete(removableKey);
    }
    this.shared.set(normalizedKey, value);
    return this;
  }

  get(key, fallback = undefined) {
    const normalized = String(key);
    return this.shared.has(normalized) ? this.shared.get(normalized) : fallback;
  }

  setStageOutput(stageId, output) {
    this.stageOutputs.set(String(stageId || ''), output);
    return this;
  }

  getStageOutput(stageId, fallback = undefined) {
    const id = String(stageId || '');
    return this.stageOutputs.has(id) ? this.stageOutputs.get(id) : fallback;
  }

  addDiagnostic(record = {}) {
    pushBounded(this.diagnostics, {
      level: String(record.level || 'info'),
      message: String(record.message || ''),
      code: String(record.code || ''),
      data: { ...(record.data || {}) },
      timestamp: Number(record.timestamp) || Date.now()
    }, this.limits.diagnostics);
    return this;
  }

  addStageTiming(stageId, durationMs, success = true, metadata = {}) {
    pushBounded(this.timing.stages, {
      stageId: String(stageId || ''),
      durationMs: Math.max(0, Number(durationMs) || 0),
      success: success === true,
      metadata: { ...(metadata || {}) }
    }, this.limits.stageTimings);
    return this;
  }

  getCommandInput() {
    const intentText = this.get('assistant.commandIntentText', '');
    return String(intentText || this.normalizedInput || this.rawInput || '').trim();
  }

  setMetadata(key, value) {
    this.metadata[String(key || '')] = value;
    return this;
  }

  completeTiming(durationMs) {
    this.timing.finishedAt = Date.now();
    this.timing.durationMs = Math.max(0, Number(durationMs) || (this.timing.finishedAt - this.timing.startedAt));
    return this;
  }

  cancel(reason = 'cancelled') {
    this.cancelled = true;
    this.cancelReason = String(reason || 'cancelled');
    return this;
  }

  toJSON() {
    return {
      requestId: this.requestId,
      conversationId: this.conversationId,
      timestamp: this.timestamp,
      source: this.source,
      rawInput: this.rawInput,
      normalizedInput: this.normalizedInput,
      normalizedInputObject: this.normalizedInputObject ? {
        normalizedText: this.normalizedInputObject.normalizedText,
        commandIntentText: this.normalizedInputObject.commandIntentText || this.normalizedInputObject.metadata?.commandIntentText || '',
        language: this.normalizedInputObject.language,
        normalizationVersion: this.normalizedInputObject.normalizationVersion,
        historyCount: this.normalizedInputObject.normalizationHistory?.length || 0
      } : null,
      linguisticGraph: this.linguisticGraph ? {
        normalizedSentence: this.linguisticGraph.normalizedSentence,
        tokenCount: this.linguisticGraph.tokens?.length || 0,
        sentenceCount: this.linguisticGraph.sentences?.length || 0,
        clauseCount: this.linguisticGraph.clauses?.length || 0,
        dependencyCount: this.linguisticGraph.dependencies?.length || 0,
        linguisticVersion: this.linguisticGraph.linguisticVersion
      } : null,
      semanticRepresentation: this.semanticRepresentation ? {
        conceptCount: this.semanticRepresentation.concepts?.length || 0,
        relationshipCount: this.semanticRepresentation.relationships?.length || 0,
        conversationType: this.semanticRepresentation.conversationType?.type || null,
        confidence: this.semanticRepresentation.confidenceScores?.overall || 0,
        version: this.semanticRepresentation.version
      } : null,
      metadata: { ...this.metadata },
      rawUserInput: this.rawUserInput,
      diagnostics: this.diagnostics.slice(),
      shared: Object.fromEntries(this.shared.entries()),
      stageOutputs: Object.fromEntries(this.stageOutputs.entries()),
      timing: {
        ...this.timing,
        stages: this.timing.stages.slice()
      },
      cancelled: this.cancelled,
      cancelReason: this.cancelReason
    };
  }
}

class PipelineDiagnostics {
  constructor(options = {}) {
    this.performance = options.performance || new PerformanceTracker();
    this.records = [];
    this.maxRecords = Number.isFinite(options.maxRecords) ? Math.max(25, Number(options.maxRecords)) : 1000;
  }

  record(level, message, data = {}) {
    const record = {
      level: String(level || 'info'),
      message: String(message || ''),
      data: { ...(data || {}) },
      timestamp: Date.now()
    };
    this.records.push(record);
    this.records = this.records.slice(-this.maxRecords);
    return record;
  }

  recordStage(stageId, durationMs, metadata = {}) {
    return this.performance.record(`stage:${stageId}`, durationMs, metadata);
  }

  recordError(error, metadata = {}) {
    return this.record('error', error?.message || 'Pipeline error.', {
      ...metadata,
      error: serializeError(error)
    });
  }

  memorySnapshot() {
    if (typeof process === 'undefined' || typeof process.memoryUsage !== 'function') return null;
    const memory = process.memoryUsage();
    return {
      rss: memory.rss,
      heapTotal: memory.heapTotal,
      heapUsed: memory.heapUsed,
      external: memory.external
    };
  }

  list(limit = 100) {
    return this.records.slice(-Math.max(1, Number(limit) || 100));
  }

  clear() {
    const count = this.records.length;
    this.records = [];
    return count;
  }

  summary(limit = 100) {
    const records = this.list(limit);
    const byLevel = records.reduce((summary, record) => {
      summary[record.level] = (summary[record.level] || 0) + 1;
      return summary;
    }, {});
    return {
      total: this.records.length,
      sampled: records.length,
      byLevel,
      memory: this.memorySnapshot(),
      performance: typeof this.performance.summary === 'function' ? this.performance.summary() : null
    };
  }
}

class PipelineLogger {
  constructor(logger = null) {
    this.logger = safeLogger(logger);
  }

  _log(level, message, data = {}) {
    this.logger[level](`[PIPELINE] ${message}`, data);
  }

  debug(message, data) { this._log('debug', message, data); }
  info(message, data) { this._log('info', message, data); }
  warn(message, data) { this._log('warn', message, data); }
  error(message, data) { this._log('error', message, data); }

  child(scope = '') {
    const prefix = String(scope || '').trim();
    return {
      debug: (message, data) => this.debug(prefix ? `${prefix}: ${message}` : message, data),
      info: (message, data) => this.info(prefix ? `${prefix}: ${message}` : message, data),
      warn: (message, data) => this.warn(prefix ? `${prefix}: ${message}` : message, data),
      error: (message, data) => this.error(prefix ? `${prefix}: ${message}` : message, data)
    };
  }
}

class PipelineResult {
  constructor({ success = true, cancelled = false, context = null, stageResults = [], output = null, diagnostics = [], timing = {}, error = null } = {}) {
    this.success = success === true;
    this.cancelled = cancelled === true;
    this.context = context;
    this.stageResults = Array.isArray(stageResults) ? stageResults.slice() : [];
    this.output = output;
    this.diagnostics = Array.isArray(diagnostics) ? diagnostics.slice() : [];
    this.timing = { ...(timing || {}) };
    this.error = error ? serializeError(error) : null;
    deepFreeze(this);
  }

  get lastStageResult() {
    return this.stageResults.length ? this.stageResults[this.stageResults.length - 1] : null;
  }

  get failedStageResults() {
    return this.stageResults.filter(result => result.success === false);
  }

  toJSON() {
    return {
      success: this.success,
      cancelled: this.cancelled,
      context: this.context,
      stageResults: this.stageResults,
      output: this.output,
      diagnostics: this.diagnostics,
      timing: this.timing,
      error: this.error
    };
  }
}

class PipelineRegistry {
  constructor() {
    this.stages = new Map();
  }

  register(stage, options = {}) {
    if (!stage || typeof stage.execute !== 'function') {
      throw new ConfigurationError('Pipeline stage must provide execute(context).');
    }
    const id = String(options.id || stage.id || stage.name || stage.constructor?.name || '').trim();
    if (!id) throw new ConfigurationError('Pipeline stage id is required.');
    if (this.stages.has(id) && options.replace !== true) {
      throw new ConfigurationError(`Pipeline stage already registered: ${id}`);
    }
    stage.id = id;
    if (options.name) stage.name = String(options.name);
    if (Number.isFinite(options.order)) stage.order = Number(options.order);
    if (options.enabled !== undefined) stage.enabled = options.enabled !== false;
    this.stages.set(id, stage);
    return this;
  }

  registerAll(stages = []) {
    for (const item of stages) {
      if (Array.isArray(item)) this.register(item[0], item[1] || {});
      else this.register(item);
    }
    return this;
  }

  unregister(id) {
    return this.stages.delete(String(id || '').trim());
  }

  get(id) {
    return this.stages.get(String(id || '').trim()) || null;
  }

  has(id) {
    return this.stages.has(String(id || '').trim());
  }

  list({ includeDisabled = true } = {}) {
    return [...this.stages.values()]
      .filter(stage => includeDisabled || stage.enabled !== false)
      .sort((left, right) => {
        const order = (Number(left.order) || 0) - (Number(right.order) || 0);
        return order || String(left.id).localeCompare(String(right.id));
      });
  }

  health() {
    return this.list().map(stage => (typeof stage.describe === 'function'
      ? stage.describe()
      : {
        id: stage.id,
        name: stage.name,
        order: stage.order,
        enabled: stage.enabled !== false,
        initialized: stage.initialized === true
      }));
  }

  clear() {
    const count = this.stages.size;
    this.stages.clear();
    return count;
  }

  count() {
    return this.stages.size;
  }
}

class PipelineBuilder {
  constructor(options = {}) {
    this.container = options.container || new ServiceContainer();
    this.registry = options.registry || new PipelineRegistry();
    this.configuration = new PipelineConfiguration(options.configuration || {});
    this.dispatcher = options.dispatcher || new PipelineEventDispatcher();
    this.diagnostics = options.diagnostics || new PipelineDiagnostics();
    this.logger = options.logger || null;
  }

  registerService(name, factoryOrValue) {
    this.container.register(name, factoryOrValue);
    return this;
  }

  registerStage(stageOrFactory, options = {}) {
    let stage = stageOrFactory;
    if (typeof stageOrFactory === 'function' && !stageOrFactory.execute) {
      stage = typeof stageOrFactory.prototype?.execute === 'function'
        ? new stageOrFactory(options)
        : stageOrFactory(this.container);
    }
    this.registry.register(stage, options);
    return this;
  }

  registerStages(stages = []) {
    for (const item of stages) {
      if (Array.isArray(item)) this.registerStage(item[0], item[1] || {});
      else this.registerStage(item);
    }
    return this;
  }

  configure(options = {}) {
    this.configuration = new PipelineConfiguration({
      ...this.configuration,
      ...(options || {})
    });
    return this;
  }

  build() {
    return new PipelineEngine({
      registry: this.registry,
      configuration: this.configuration,
      diagnostics: this.diagnostics,
      dispatcher: this.dispatcher,
      logger: this.logger
    });
  }

  getStatus() {
    return {
      configuration: this.configuration.toJSON(),
      stages: this.registry.health(),
      diagnostics: typeof this.diagnostics.summary === 'function' ? this.diagnostics.summary(25) : null
    };
  }
}

class PipelineEngine {
  constructor({ registry, configuration = {}, diagnostics = null, dispatcher = null, logger = null } = {}) {
    this.registry = registry;
    this.configuration = configuration instanceof PipelineConfiguration
      ? configuration
      : new PipelineConfiguration(configuration);
    this.diagnostics = diagnostics || new PipelineDiagnostics();
    this.dispatcher = dispatcher || new PipelineEventDispatcher();
    this.logger = logger instanceof PipelineLogger ? logger : new PipelineLogger(logger);
    this.running = false;
  }

  async run(input = {}) {
    const context = input instanceof PipelineContext ? input : new PipelineContext(input);
    context.limits.diagnostics = this.configuration.maxDiagnostics;
    context.limits.stageTimings = this.configuration.maxStageTimings;
    context.limits.sharedEntries = this.configuration.maxSharedEntries;
    const stopwatch = new Stopwatch().start();
    const stageResults = [];
    let error = null;
    let output = null;
    this.running = true;
    this.dispatcher.dispatch(PipelineEvents.PIPELINE_STARTED, {
      requestId: context.requestId,
      source: context.source,
      stageCount: this.registry?.count?.() ?? 0
    });
    try {
      const stages = this.configuration.enabled === false ? [] : this.registry.list({ includeDisabled: false });
      const execution = this._runStages(context, stages, stageResults);
      await withTimeout(execution, this.configuration.timeoutMs, () => new TimeoutError('Assistant Intelligence pipeline timed out.'));
      output = stageResults.length > 0 ? stageResults[stageResults.length - 1].output : {
        input: context.rawInput,
        source: context.source,
        options: { ...(context.options || {}) }
      };
      if (context.cancelled) throw new CancellationError(context.cancelReason || 'Pipeline cancelled.');
      return this._finish(context, stageResults, output, stopwatch, null);
    } catch (err) {
      error = normalizeError(err);
      this.diagnostics.recordError(error, { requestId: context.requestId });
      context.addDiagnostic({
        level: 'error',
        message: error.message,
        code: error.code || 'pipeline-error',
        data: { requestId: context.requestId }
      });
      this.dispatcher.dispatch(
        error instanceof CancellationError ? PipelineEvents.PIPELINE_CANCELLED : PipelineEvents.PIPELINE_ERROR,
        { requestId: context.requestId, error }
      );
      return this._finish(context, stageResults, output, stopwatch, error);
    } finally {
      this.running = false;
    }
  }

  async _runStages(context, stages, stageResults) {
    for (const stage of stages) {
      if (context.cancelled) break;
      if (stage.enabled === false) continue;
      if (typeof stage.supports === 'function' && !stage.supports(context)) {
        const skipped = StageResult.skipped(stage.id, 'Stage does not support this context.');
        stageResults.push(skipped);
        if (typeof stage.markRun === 'function') stage.markRun(skipped);
        continue;
      }
      const stageWatch = new Stopwatch().start();
      const stageOptions = this.configuration.optionsForStage(stage.id);
      this.dispatcher.dispatch(PipelineEvents.STAGE_STARTED, { requestId: context.requestId, stageId: stage.id, order: stage.order });
      try {
        if (!stage.initialized && typeof stage.initialize === 'function') await stage.initialize();
        if (typeof stage.validate === 'function') await stage.validate(context);
        const result = await this._executeStage(stage, context, stageOptions);
        const durationMs = stageWatch.stop();
        const stageResult = result instanceof StageResult
          ? new StageResult({ ...result, metadata: { ...result.metadata, stageOptions }, durationMs: result.durationMs || durationMs })
          : StageResult.ok(stage.id, result, { durationMs, metadata: { stageOptions } });
        if (this.configuration.collectStageOutputs) context.setStageOutput(stage.id, stageResult.output);
        context.addStageTiming(stage.id, durationMs, stageResult.success, { skipped: stageResult.skipped });
        stageResults.push(stageResult);
        if (typeof stage.markRun === 'function') stage.markRun(stageResult);
        this.diagnostics.recordStage(stage.id, durationMs, { success: stageResult.success });
        this.dispatcher.dispatch(PipelineEvents.STAGE_COMPLETED, {
          requestId: context.requestId,
          stageId: stage.id,
          durationMs,
          success: stageResult.success,
          skipped: stageResult.skipped
        });
        if (!stageResult.success && !this.configuration.continueOnStageFailure) break;
      } catch (err) {
        const durationMs = stageWatch.stop();
        const error = err instanceof StageExecutionError || err instanceof StageTimeoutError
          ? err
          : new StageExecutionError(err.message, { stageId: stage.id, requestId: context.requestId, cause: err });
        const failed = StageResult.failed(stage.id, error, { durationMs });
        context.addStageTiming(stage.id, durationMs, false);
        stageResults.push(failed);
        if (typeof stage.markRun === 'function') stage.markRun(failed);
        this.diagnostics.recordError(error, { stageId: stage.id, requestId: context.requestId });
        this.dispatcher.dispatch(PipelineEvents.STAGE_FAILED, { requestId: context.requestId, stageId: stage.id, error });
        if (!this.configuration.continueOnStageFailure) throw error;
      } finally {
        if (typeof stage.cleanup === 'function') await stage.cleanup(context);
      }
    }
  }

  async _executeStage(stage, context, stageOptions = {}) {
    const timeoutMs = Number(stageOptions.timeoutMs ?? this.configuration.stageTimeoutMs);
    return withTimeout(
      Promise.resolve().then(() => stage.execute(context)),
      timeoutMs,
      () => new StageTimeoutError(`Pipeline stage timed out: ${stage.id}`, {
        stageId: stage.id,
        requestId: context.requestId,
        details: { timeoutMs }
      })
    );
  }

  _finish(context, stageResults, output, stopwatch, error) {
    const durationMs = stopwatch.stop();
    context.completeTiming(durationMs);
    const diagnostics = this.configuration.collectDiagnostics
      ? context.diagnostics.concat(this.diagnostics.list(Math.min(25, this.configuration.maxDiagnostics)))
      : [];
    const result = new PipelineResult({
      success: !error,
      cancelled: error instanceof CancellationError,
      context: context.toJSON(),
      stageResults,
      output,
      diagnostics,
      timing: context.timing,
      error
    });
    this.dispatcher.dispatch(PipelineEvents.PIPELINE_FINISHED, {
      requestId: context.requestId,
      success: result.success,
      durationMs
    });
    return result;
  }
}

class PipelineManager {
  constructor(options = {}) {
    this.builder = options.builder || new PipelineBuilder(options);
    this.engine = options.engine || null;
    this.started = false;
    this.options = { ...(options || {}) };
    this.defaultStagesRegistered = false;
    if (options.defaultStages !== false) {
      this.registerDefaultStages(options);
    }
  }

  registerDefaultStages(options = this.options) {
    if (this.defaultStagesRegistered) return this;
    const logger = options.logger || null;
    const configuration = options.configuration || {};
    const stages = [
      [new LanguageNormalizationStage({ configuration: options.normalization || configuration.normalization || {}, logger }), { id: 'assistant.language.normalization', order: -100 }],
      [new LinguisticUnderstandingStage({ configuration: options.linguistic || configuration.linguistic || {}, logger }), { id: 'assistant.linguistic.understanding', order: -50 }],
      [new SemanticUnderstandingStage({ configuration: options.semantic || configuration.semantic || {}, logger }), { id: 'assistant.semantic.understanding', order: -25 }],
      [new EntityUnderstandingStage({ configuration: options.entities || configuration.entities || {}, logger }), { id: 'assistant.entity.understanding', order: -10 }],
      [new MemoryContextStage({ configuration: options.memory || configuration.memory || {}, logger }), { id: 'assistant.memory.context', order: -5 }],
      [new GoalIntentReasoningStage({ configuration: options.reasoning || configuration.reasoning || {}, logger }), { id: 'assistant.goalIntent.reasoning', order: -2 }],
      [new TaskPlanningStage({ configuration: options.planning || configuration.planning || {}, logger }), { id: 'assistant.task.planning', order: -1 }],
      [new DecisionValidationAutomationStage({
        configuration: options.decisionAutomation || configuration.decisionAutomation || {},
        automationEngine: options.automationEngine || null,
        logger
      }), { id: 'assistant.decision.validation.automation', order: -0.5 }],
      [new VerificationResponseStage({ configuration: options.verificationResponse || configuration.verificationResponse || {}, logger }), { id: 'assistant.verification.response', order: -0.25 }],
      [new AssistantExecutionStage({ executor: options.commandExecutor || options.executor || null, logger }), { id: 'assistant.execution', order: 0.1 }]
    ];
    stages.forEach(([stage, stageOptions]) => {
      if (!this.builder.registry.has(stageOptions.id)) this.builder.registerStage(stage, stageOptions);
    });
    this.defaultStagesRegistered = true;
    return this;
  }

  start() {
    if (!this.engine) this.engine = this.builder.build();
    this.started = true;
    return this;
  }

  async process({ input = '', source = 'chat', options = {}, requestId = '', conversationId = '', rawUserInput = null } = {}) {
    if (!this.started) this.start();
    const text = rawUserInput?.rawText ?? input;
    return this.engine.run({
      requestId: requestId || rawUserInput?.requestId || '',
      conversationId: conversationId || rawUserInput?.conversationId || '',
      source: rawUserInput?.source || source,
      rawInput: text,
      normalizedInput: text,
      options,
      rawUserInput,
      metadata: {
        ...(options.pipelineMetadata || {}),
        sourceType: rawUserInput?.sourceType || source,
        acquisitionConfidence: rawUserInput?.confidence
      }
    });
  }

  configure(options = {}) {
    this.builder.configure(options);
    this.engine = null;
    if (this.started) this.start();
    return this;
  }

  getEngine() {
    if (!this.started) this.start();
    return this.engine;
  }

  stop() {
    this.started = false;
    return this;
  }

  getStatus() {
    return {
      started: this.started,
      running: this.engine?.running === true,
      stageCount: this.builder.registry.count(),
      stages: this.builder.registry.health(),
      builder: typeof this.builder.getStatus === 'function' ? this.builder.getStatus() : null
    };
  }

  async destroy() {
    this.stop();
    const stages = this.builder.registry.list();
    for (const stage of stages) {
      if (typeof stage.destroy === 'function') await stage.destroy();
    }
    this.builder.registry.clear();
    this.engine = null;
  }
}

module.exports = {
  PIPELINE_LAYER_VERSION,
  PipelineBuilder,
  PipelineConfiguration,
  PipelineContext,
  PipelineDiagnostics,
  PipelineEngine,
  PipelineEvents,
  PipelineLogger,
  PipelineManager,
  PipelineRegistry,
  PipelineResult
};