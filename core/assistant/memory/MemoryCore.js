'use strict';

const { deepFreeze, sanitizeDetails, withTimeout } = require('../utils');
const PipelineStage = require('../pipeline/PipelineStage');
const StageResult = require('../pipeline/StageResult');
const {
  ReferenceResolver,
  PronounResolver,
  AliasResolver,
  ConversationResolver,
  ContextResolver,
  ReferenceGraphBuilder
} = require('../references');
const {
  ApplicationContext,
  BrowserContext,
  CalendarContext,
  ClipboardContext,
  DesktopContext,
  MediaContext,
  ScreenContext,
  SelectionContext,
  SystemContext,
  TimeContext,
  UserContext,
  WindowContext
} = require('../context/ContextProviders');
const {
  BaseMemoryProvider,
  WorkingMemory,
  ConversationMemory,
  SessionMemory,
  DialogueHistory,
  TopicTracker,
  LongTermMemory
} = require('./MemoryProviders');

class MemoryError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = details.context || null;
    this.diagnostics = details.diagnostics || [];
    this.code = details.code || this.constructor.name;
    if (details.cause) this.cause = details.cause;
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      diagnostics: this.diagnostics,
      cause: this.cause ? {
        name: this.cause.name || 'Error',
        message: this.cause.message || String(this.cause)
      } : null
    };
  }
}

class ReferenceResolutionError extends MemoryError {}
class ContextError extends MemoryError {}
class ProviderError extends MemoryError {}
class ConfigurationError extends MemoryError {}
class PipelineError extends MemoryError {}
class ProviderTimeoutError extends ProviderError {}

const MemoryErrors = {
  MemoryError,
  ReferenceResolutionError,
  ContextError,
  ProviderError,
  ProviderTimeoutError,
  ConfigurationError,
  PipelineError
};

const DEFAULT_PROVIDER_OPTIONS = Object.freeze({
  enabled: true,
  priority: 100,
  ttlMs: 30 * 60 * 1000,
  limit: 50,
  timeoutMs: 250
});

class MemoryConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || '7.0.0');
    this.strict = input.strict === true;
    this.memoryLimit = Math.max(5, Number(input.memoryLimit || 50));
    this.workingMemoryTtlMs = Math.max(1000, Number(input.workingMemoryTtlMs || 30 * 60 * 1000));
    this.contextRefreshMs = Math.max(100, Number(input.contextRefreshMs || 1000));
    this.providerTimeoutMs = Math.max(10, Number(input.providerTimeoutMs || 250));
    this.maxDiagnostics = Math.max(25, Number(input.maxDiagnostics || 100));
    this.maxEntitySnapshots = Math.max(10, Number(input.maxEntitySnapshots || 50));
    this.maxTextLength = Math.max(80, Number(input.maxTextLength || 500));
    this.providers = { ...(input.providers || {}) };
    this.memoryProviders = { ...(input.memoryProviders || {}) };
    this.referenceResolvers = { ...(input.referenceResolvers || {}) };
    this.contextProviders = { ...(input.contextProviders || {}) };
    this.aliases = { ...(input.aliases || {}) };
    this.longTermMemory = input.longTermMemory || null;
  }

  getProviderOptions(group, id, defaults = {}) {
    const configured = this[group]?.[String(id || '')] || {};
    return {
      ...DEFAULT_PROVIDER_OPTIONS,
      ...(defaults || {}),
      ...configured
    };
  }

  toJSON() {
    return {
      enabled: this.enabled,
      version: this.version,
      strict: this.strict,
      memoryLimit: this.memoryLimit,
      workingMemoryTtlMs: this.workingMemoryTtlMs,
      contextRefreshMs: this.contextRefreshMs,
      providerTimeoutMs: this.providerTimeoutMs,
      maxDiagnostics: this.maxDiagnostics,
      maxEntitySnapshots: this.maxEntitySnapshots,
      maxTextLength: this.maxTextLength,
      providers: { ...this.providers },
      memoryProviders: { ...this.memoryProviders },
      referenceResolvers: { ...this.referenceResolvers },
      contextProviders: { ...this.contextProviders },
      aliases: { ...this.aliases },
      longTermMemory: this.longTermMemory ? '[configured]' : null
    };
  }
}
MemoryConfiguration.DEFAULT_PROVIDER_OPTIONS = DEFAULT_PROVIDER_OPTIONS;

const DEFAULT_MAX_DIAGNOSTIC_ITEMS = 100;

function pushBounded(list, item, limit = DEFAULT_MAX_DIAGNOSTIC_ITEMS) {
  list.push(item);
  if (list.length > limit) list.splice(0, list.length - limit);
}

class MemoryDiagnostics {
  constructor(options = {}) {
    this.limit = Math.max(25, Number(options.limit) || DEFAULT_MAX_DIAGNOSTIC_ITEMS);
    this.resolutionTime = {};
    this.referenceResolutionSuccess = {};
    this.contextProvidersExecuted = [];
    this.cacheStatistics = {};
    this.warnings = [];
    this.errors = [];
    this.pipelineOrder = [];
    this.memoryUsage = this._memoryUsage();
  }

  time(id, durationMs) {
    this.resolutionTime[String(id || '')] = Math.max(0, Number(durationMs) || 0);
  }

  reference(id, success) {
    this.referenceResolutionSuccess[String(id || '')] = Boolean(success);
  }

  provider(id) {
    pushBounded(this.contextProvidersExecuted, String(id || ''), this.limit);
  }

  warn(message, data = {}) {
    pushBounded(this.warnings, { message: String(message || ''), data, timestamp: Date.now() }, this.limit);
  }

  error(error, data = {}) {
    pushBounded(this.errors, {
      name: error?.name || 'Error',
      message: String(error?.message || error || ''),
      stack: error?.stack || '',
      data,
      timestamp: Date.now()
    }, this.limit);
  }

  order(id) {
    pushBounded(this.pipelineOrder, String(id || ''), this.limit);
  }

  _memoryUsage() {
    return typeof process !== 'undefined' && typeof process.memoryUsage === 'function'
      ? process.memoryUsage()
      : null;
  }

  toJSON() {
    return {
      resolutionTime: { ...this.resolutionTime },
      memoryUsage: this.memoryUsage,
      referenceResolutionSuccess: { ...this.referenceResolutionSuccess },
      contextProvidersExecuted: this.contextProvidersExecuted.slice(),
      cacheStatistics: { ...this.cacheStatistics },
      warnings: this.warnings.slice(),
      errors: this.errors.slice(),
      pipelineOrder: this.pipelineOrder.slice()
    };
  }

  summary() {
    return {
      warningCount: this.warnings.length,
      errorCount: this.errors.length,
      providerCount: this.contextProvidersExecuted.length,
      pipelineCount: this.pipelineOrder.length,
      memoryUsage: this.memoryUsage
    };
  }
}

class MemoryLogger {
  constructor(logger = null) {
    this.logger = logger || null;
  }

  _log(level, message, data = {}) {
    this.logger?.[level]?.(`[MEMORY] ${message}`, sanitizeDetails(data));
  }

  debug(message, data) { this._log('debug', message, data); }
  info(message, data) { this._log('info', message, data); }
  warn(message, data) { this._log('warn', message, data); }
  error(message, data) { this._log('error', message, data); }
}

class ResolvedContext {
  constructor(input = {}) {
    this.workingMemory = input.workingMemory || {};
    this.conversationMemory = input.conversationMemory || {};
    this.sessionMemory = input.sessionMemory || {};
    this.dialogueHistory = input.dialogueHistory || [];
    this.topic = input.topic || null;
    this.resolvedReferences = input.resolvedReferences || [];
    this.resolvedAliases = input.resolvedAliases || [];
    this.resolvedPronouns = input.resolvedPronouns || [];
    this.application = input.application || {};
    this.runningApplications = input.runningApplications || [];
    this.desktopState = input.desktopState || {};
    this.browserState = input.browserState || {};
    this.screen = input.screen || {};
    this.clipboard = input.clipboard || {};
    this.selections = input.selections || {};
    this.windows = input.windows || {};
    this.system = input.system || {};
    this.media = input.media || {};
    this.calendar = input.calendar || {};
    this.time = input.time || {};
    this.user = input.user || {};
    this.metadata = { ...(input.metadata || {}) };
    this.diagnostics = input.diagnostics || {};
    this.confidence = Math.max(0, Math.min(1, Number(input.confidence ?? 0)));
    this.timing = { ...(input.timing || {}) };
    this.version = String(input.version || '7.0.0');
    this.futureExtensions = { ...(input.futureExtensions || {}) };
    deepFreeze(this);
  }

  getRecentReference(type = '') {
    const wanted = String(type || '');
    return this.conversationMemory?.references?.slice().reverse().find(reference => !wanted || reference.type === wanted) || null;
  }

  hasContext() {
    return Boolean(
      Object.keys(this.workingMemory || {}).length ||
      Object.keys(this.sessionMemory || {}).length ||
      (this.resolvedReferences || []).length ||
      this.topic
    );
  }

  toJSON() {
    return {
      workingMemory: this.workingMemory,
      conversationMemory: this.conversationMemory,
      sessionMemory: this.sessionMemory,
      dialogueHistory: this.dialogueHistory,
      topic: this.topic,
      resolvedReferences: this.resolvedReferences,
      resolvedAliases: this.resolvedAliases,
      resolvedPronouns: this.resolvedPronouns,
      application: this.application,
      runningApplications: this.runningApplications,
      desktopState: this.desktopState,
      browserState: this.browserState,
      screen: this.screen,
      clipboard: this.clipboard,
      selections: this.selections,
      windows: this.windows,
      system: this.system,
      media: this.media,
      calendar: this.calendar,
      time: this.time,
      user: this.user,
      metadata: this.metadata,
      diagnostics: this.diagnostics,
      confidence: this.confidence,
      timing: this.timing,
      version: this.version,
      futureExtensions: this.futureExtensions
    };
  }
}

function allEntities(structuredEntities) {
  if (!structuredEntities || typeof structuredEntities !== 'object') return [];
  return [
    'applications', 'browsers', 'files', 'folders', 'paths', 'websites', 'contacts',
    'people', 'devices', 'media', 'dates', 'times', 'durations', 'reminders',
    'alarms', 'timers', 'locations', 'windows', 'networks', 'volumeLevels',
    'brightnessLevels'
  ].flatMap(key => Array.isArray(structuredEntities[key]) ? structuredEntities[key] : []);
}

function inputText(structuredEntities, metadata = {}) {
  return String(
    metadata.rawInput ||
    metadata.input ||
    metadata.normalizedInput ||
    structuredEntities?.metadata?.rawInput ||
    structuredEntities?.metadata?.input ||
    structuredEntities?.metadata?.normalizedInput ||
    ''
  );
}

function compactText(value, limit = 500) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, Math.max(1, limit - 3)).trim()}...` : text;
}

function compactEntity(entity = {}) {
  return sanitizeDetails({
    type: entity.type,
    value: entity.canonical || entity.value,
    confidence: entity.confidence,
    role: entity.role,
    source: entity.source
  });
}

class MemoryContext {
  constructor({ structuredEntities = null, configuration = null, state = null, metadata = {}, snapshots = {} } = {}) {
    this.structuredEntities = structuredEntities || null;
    this.configuration = configuration || null;
    this.state = state || {};
    this.metadata = { ...(metadata || {}) };
    this.snapshots = { ...(snapshots || {}) };
    this.limits = {
      memoryLimit: Math.max(5, Number(configuration?.memoryLimit) || 50),
      maxEntitySnapshots: Math.max(10, Number(configuration?.maxEntitySnapshots) || 50),
      maxTextLength: Math.max(80, Number(configuration?.maxTextLength) || 500)
    };
    this.input = compactText(inputText(structuredEntities, this.metadata), this.limits.maxTextLength);
    this.entities = allEntities(structuredEntities).slice(-this.limits.maxEntitySnapshots);
    this.workingMemory = {};
    this.conversationMemory = {};
    this.sessionMemory = {};
    this.dialogueHistory = [];
    this.topic = null;
    this.references = [];
    this.resolvedReferences = [];
    this.resolvedAliases = [];
    this.resolvedPronouns = [];
    this.context = {
      application: {},
      runningApplications: [],
      desktopState: {},
      browserState: {},
      screen: {},
      clipboard: {},
      selections: {},
      windows: {},
      system: {},
      media: {},
      calendar: {},
      time: {},
      user: {}
    };
    this.diagnostics = new MemoryDiagnostics({ limit: configuration?.maxDiagnostics });
    this.timing = { startedAt: Date.now(), finishedAt: null, durationMs: 0 };
    this.futureExtensions = {};
  }

  latestEntity(types = []) {
    const allowed = new Set(types);
    return this.entities.slice().reverse().find(entity => allowed.has(entity.type)) || null;
  }

  compactEntity(entity = {}) {
    return compactEntity(entity);
  }

  rememberState(key, value, limit = this.limits.memoryLimit) {
    const normalized = String(key || '');
    if (!normalized) return this;
    const list = Array.isArray(this.state[normalized]) ? this.state[normalized] : [];
    list.push(value);
    this.state[normalized] = list.slice(-Math.max(1, Number(limit) || this.limits.memoryLimit));
    return this;
  }

  entitySnapshot(limit = this.limits.maxEntitySnapshots) {
    return this.entities.slice(-Math.max(1, Number(limit) || this.limits.maxEntitySnapshots)).map(entity => compactEntity(entity));
  }

  confidence() {
    const resolved = this.resolvedReferences.length + this.resolvedAliases.length + this.resolvedPronouns.length;
    const refs = Math.max(1, this.references.length);
    const entityConfidence = this.entities.length
      ? this.entities.reduce((sum, entity) => sum + Number(entity.confidence || 0), 0) / this.entities.length
      : 0;
    return Number(Math.max(entityConfidence, resolved / refs).toFixed(3));
  }

  toResolvedContext() {
    this.timing.finishedAt = this.timing.finishedAt || Date.now();
    this.timing.durationMs = Math.max(0, this.timing.finishedAt - this.timing.startedAt);
    return new ResolvedContext({
      workingMemory: this.workingMemory,
      conversationMemory: this.conversationMemory,
      sessionMemory: this.sessionMemory,
      dialogueHistory: this.dialogueHistory,
      topic: this.topic,
      resolvedReferences: this.resolvedReferences,
      resolvedAliases: this.resolvedAliases,
      resolvedPronouns: this.resolvedPronouns,
      ...this.context,
      metadata: this.metadata,
      diagnostics: this.diagnostics.toJSON(),
      confidence: this.confidence(),
      timing: this.timing,
      version: this.configuration?.version || '7.0.0',
      futureExtensions: this.futureExtensions
    });
  }
}
MemoryContext.compactEntity = compactEntity;
MemoryContext.compactText = compactText;

function ordered(items, includeDisabled = true) {
  return [...items.values()]
    .filter(item => includeDisabled || item.enabled !== false)
    .sort((left, right) => (Number(left.priority) || 0) - (Number(right.priority) || 0) || String(left.id).localeCompare(String(right.id)));
}

class MemoryRegistry {
  constructor() {
    this.memoryProviders = new Map();
    this.referenceResolvers = new Map();
    this.contextProviders = new Map();
    this.topicProviders = new Map();
  }

  registerMemoryProvider(provider, options = {}) {
    return this._register(this.memoryProviders, provider, 'apply', options);
  }

  registerReferenceResolver(resolver, options = {}) {
    return this._register(this.referenceResolvers, resolver, 'resolve', options);
  }

  registerContextProvider(provider, options = {}) {
    return this._register(this.contextProviders, provider, 'collect', options);
  }

  registerTopicProvider(provider, options = {}) {
    return this._register(this.topicProviders, provider, 'apply', options);
  }

  _register(map, item, method, options = {}) {
    if (!item || typeof item[method] !== 'function') {
      throw new ConfigurationError(`Memory component must provide ${method}(context).`);
    }
    const id = String(options.id || item.id || item.constructor?.name || '').trim();
    if (!id) throw new ConfigurationError('Memory component id is required.');
    if (map.has(id) && options.replace !== true) {
      throw new ConfigurationError(`Memory component already registered: ${id}`);
    }
    item.id = id;
    if (Number.isFinite(options.priority)) item.priority = Number(options.priority);
    if (options.enabled !== undefined) item.enabled = options.enabled !== false;
    map.set(id, item);
    return this;
  }

  registerAll(kind, components = []) {
    const method = {
      memory: this.registerMemoryProvider.bind(this),
      reference: this.registerReferenceResolver.bind(this),
      context: this.registerContextProvider.bind(this),
      topic: this.registerTopicProvider.bind(this)
    }[String(kind || '')];
    if (!method) throw new ConfigurationError(`Unknown memory registry group: ${kind}`);
    components.forEach(item => {
      if (Array.isArray(item)) method(item[0], item[1] || {});
      else method(item);
    });
    return this;
  }

  listMemoryProviders(options = {}) { return ordered(this.memoryProviders, options.includeDisabled !== false); }
  listReferenceResolvers(options = {}) { return ordered(this.referenceResolvers, options.includeDisabled !== false); }
  listContextProviders(options = {}) { return ordered(this.contextProviders, options.includeDisabled !== false); }
  listTopicProviders(options = {}) { return ordered(this.topicProviders, options.includeDisabled !== false); }

  health() {
    const serialize = item => (typeof item.describe === 'function'
      ? item.describe()
      : {
        id: item.id,
        version: item.version,
        priority: item.priority,
        enabled: item.enabled !== false,
        initialized: item.initialized === true
      });
    return {
      memoryProviders: this.listMemoryProviders().map(serialize),
      referenceResolvers: this.listReferenceResolvers().map(serialize),
      contextProviders: this.listContextProviders().map(serialize),
      topicProviders: this.listTopicProviders().map(serialize)
    };
  }

  counts() {
    return {
      memoryProviders: this.memoryProviders.size,
      referenceResolvers: this.referenceResolvers.size,
      contextProviders: this.contextProviders.size,
      topicProviders: this.topicProviders.size
    };
  }

  clear() {
    const count = this.counts();
    this.memoryProviders.clear();
    this.referenceResolvers.clear();
    this.contextProviders.clear();
    this.topicProviders.clear();
    return count;
  }
}

class MemoryPipeline {
  constructor(options = {}) {
    this.registry = options.registry || new MemoryRegistry();
    this.configuration = options.configuration instanceof MemoryConfiguration
      ? options.configuration
      : new MemoryConfiguration(options.configuration || {});
    this.state = options.state || {};
    this.logger = options.logger || null;
  }

  async run(structuredEntities, options = {}) {
    const context = new MemoryContext({
      structuredEntities,
      configuration: this.configuration,
      state: this.state,
      metadata: options.metadata || {},
      snapshots: options.snapshots || {}
    });
    if (this.configuration.enabled === false) return context.toResolvedContext();

    await this._runGroup(context, this.registry.listMemoryProviders({ includeDisabled: false }), 'apply');
    await this._runGroup(context, this.registry.listReferenceResolvers({ includeDisabled: false }), 'resolve', true);
    await this._runGroup(context, this.registry.listContextProviders({ includeDisabled: false }), 'collect');

    return context.toResolvedContext();
  }

  async _runGroup(context, components, method, references = false) {
    for (const component of components) {
      const started = Date.now();
      context.diagnostics.order(component.id);
      try {
        if (!component.initialized && typeof component.initialize === 'function') await component.initialize();
        if (typeof component.supports === 'function' && !component.supports(context)) {
          if (typeof component.markRun === 'function') component.markRun({ skipped: true, success: true });
          continue;
        }
        if (component.enabled !== false) await this._runComponent(component, method, context);
        if (typeof component.markRun === 'function') component.markRun({ success: true });
        if (method === 'collect') context.diagnostics.provider(component.id);
        if (references) {
          context.diagnostics.reference(component.id, context.resolvedReferences.length > 0 || context.references.length === 0);
        }
      } catch (error) {
        const wrapped = error instanceof ProviderTimeoutError
          ? error
          : new ProviderError(`Memory component failed: ${component.id}`, { cause: error, context: { componentId: component.id } });
        if (typeof component.markRun === 'function') component.markRun({ success: false });
        context.diagnostics.error(wrapped);
        if (this.configuration.strict) throw wrapped;
      } finally {
        context.diagnostics.time(component.id, Date.now() - started);
      }
    }
  }

  async _runComponent(component, method, context) {
    const configured = this.configuration.getProviderOptions(
      method === 'collect' ? 'contextProviders' : method === 'resolve' ? 'referenceResolvers' : 'memoryProviders',
      component.id,
      {}
    );
    const timeoutMs = Number(component.options?.timeoutMs || this.configuration.providerTimeoutMs || configured.timeoutMs);
    return withTimeout(
      Promise.resolve().then(() => component[method](context)),
      timeoutMs,
      () => new ProviderTimeoutError(`Memory component timed out: ${component.id}`, {
        context: { componentId: component.id, timeoutMs }
      })
    );
  }
}

class MemoryManager {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof MemoryConfiguration
      ? options.configuration
      : new MemoryConfiguration(options.configuration || options);
    this.registry = options.registry || new MemoryRegistry();
    this.pipeline = options.pipeline || null;
    this.state = options.state || {};
    this.logger = options.logger || null;
    this.defaultProvidersRegistered = false;
    if (options.defaultProviders !== false) this._registerDefaults();
  }

  _registerDefaults() {
    if (this.defaultProvidersRegistered) return;
    [
      [WorkingMemory, 'memory.workingMemory', 'memoryProviders', 10],
      [ConversationMemory, 'memory.conversationMemory', 'memoryProviders', 20],
      [SessionMemory, 'memory.sessionMemory', 'memoryProviders', 30],
      [DialogueHistory, 'memory.dialogueHistory', 'memoryProviders', 40],
      [TopicTracker, 'memory.topicTracker', 'memoryProviders', 50],
      [LongTermMemory, 'memory.longTermMemory', 'memoryProviders', 55],
      [ReferenceResolver, 'reference.resolver', 'referenceResolvers', 60],
      [PronounResolver, 'reference.pronounResolver', 'referenceResolvers', 70],
      [AliasResolver, 'reference.aliasResolver', 'referenceResolvers', 80],
      [ConversationResolver, 'reference.conversationResolver', 'referenceResolvers', 90],
      [ContextResolver, 'reference.contextResolver', 'referenceResolvers', 100],
      [ReferenceGraphBuilder, 'reference.graphBuilder', 'referenceResolvers', 105],
      [ApplicationContext, 'context.application', 'contextProviders', 110],
      [DesktopContext, 'context.desktop', 'contextProviders', 120],
      [BrowserContext, 'context.browser', 'contextProviders', 130],
      [ScreenContext, 'context.screen', 'contextProviders', 140],
      [ClipboardContext, 'context.clipboard', 'contextProviders', 150],
      [SystemContext, 'context.system', 'contextProviders', 160],
      [CalendarContext, 'context.calendar', 'contextProviders', 170],
      [MediaContext, 'context.media', 'contextProviders', 180],
      [TimeContext, 'context.time', 'contextProviders', 190],
      [UserContext, 'context.user', 'contextProviders', 200],
      [SelectionContext, 'context.selection', 'contextProviders', 210],
      [WindowContext, 'context.window', 'contextProviders', 220]
    ].forEach(([Ctor, id, group, priority]) => {
      const target = group === 'memoryProviders'
        ? this.registry.memoryProviders
        : group === 'referenceResolvers'
          ? this.registry.referenceResolvers
          : this.registry.contextProviders;
      if (target?.has(id)) return;
      const configured = this.configuration.getProviderOptions(group, id, { priority });
      const instance = new Ctor({ id, ...configured, aliases: this.configuration.aliases });
      if (group === 'memoryProviders') this.registry.registerMemoryProvider(instance, { id, priority: configured.priority, enabled: configured.enabled });
      if (group === 'referenceResolvers') this.registry.registerReferenceResolver(instance, { id, priority: configured.priority, enabled: configured.enabled });
      if (group === 'contextProviders') this.registry.registerContextProvider(instance, { id, priority: configured.priority, enabled: configured.enabled });
    });
    this.defaultProvidersRegistered = true;
  }

  registerMemoryProvider(provider, options = {}) { this.registry.registerMemoryProvider(provider, options); return this; }
  registerReferenceResolver(resolver, options = {}) { this.registry.registerReferenceResolver(resolver, options); return this; }
  registerContextProvider(provider, options = {}) { this.registry.registerContextProvider(provider, options); return this; }
  registerTopicProvider(provider, options = {}) { this.registry.registerTopicProvider(provider, options); return this; }

  async resolve(structuredEntities, options = {}) {
    if (!this.pipeline) {
      this.pipeline = new MemoryPipeline({
        registry: this.registry,
        configuration: this.configuration,
        state: this.state,
        logger: this.logger
      });
    }
    return this.pipeline.run(structuredEntities, options);
  }

  resetPipeline() {
    this.pipeline = null;
    return this;
  }

  clearState() {
    this.state = {};
    this.resetPipeline();
    return this;
  }

  getStatus() {
    return {
      enabled: this.configuration.enabled,
      version: this.configuration.version,
      counts: this.registry.counts(),
      stateKeys: Object.keys(this.state || {}),
      ...this.registry.health()
    };
  }

  async destroy() {
    for (const group of [this.registry.listMemoryProviders(), this.registry.listReferenceResolvers(), this.registry.listContextProviders()]) {
      for (const item of group) await item.destroy?.();
    }
    this.registry.clear();
    this.pipeline = null;
    this.state = {};
  }
}

function createDefaultMemoryManager(options = {}) {
  return new MemoryManager(options);
}

class MemoryContextStage extends PipelineStage {
  constructor(options = {}) {
    super({
      id: options.id || 'assistant.memory.context',
      name: options.name || 'Assistant Memory and Context',
      order: Number.isFinite(options.order) ? options.order : -5,
      enabled: options.enabled !== false
    });
    this.manager = options.manager || createDefaultMemoryManager({
      configuration: options.configuration || {},
      logger: options.logger || null
    });
  }

  async execute(context) {
    if (!context.structuredEntities) {
      return StageResult.skipped(this.id, 'No StructuredEntities available.');
    }
    const resolvedContext = await this.manager.resolve(context.structuredEntities, {
      metadata: {
        ...(context.metadata || {}),
        rawInput: context.rawInput,
        source: context.source
      },
      snapshots: context.options?.contextSnapshots || context.metadata?.contextSnapshots || {}
    });
    context.resolvedContext = resolvedContext;
    context.set('assistant.resolvedContext', resolvedContext);
    context.set('assistant.memoryConfidence', resolvedContext.confidence);
    context.set('assistant.memoryTopic', resolvedContext.topic);
    return StageResult.ok(this.id, {
      referenceCount: resolvedContext.resolvedReferences.length,
      aliasCount: resolvedContext.resolvedAliases.length,
      pronounCount: resolvedContext.resolvedPronouns.length,
      dialogueTurns: resolvedContext.dialogueHistory.length,
      hasContext: resolvedContext.hasContext(),
      topic: resolvedContext.topic?.label || null,
      confidence: resolvedContext.confidence,
      version: resolvedContext.version
    });
  }

  async destroy() {
    if (typeof this.manager?.destroy === 'function') await this.manager.destroy();
    return super.destroy();
  }
}

module.exports = {
  BaseMemoryProvider,
  MemoryConfiguration,
  MemoryContext,
  MemoryContextStage,
  MemoryDiagnostics,
  MemoryErrors,
  MemoryLogger,
  MemoryManager,
  MemoryPipeline,
  MemoryRegistry,
  ResolvedContext,
  createDefaultMemoryManager,
  ...MemoryErrors
};