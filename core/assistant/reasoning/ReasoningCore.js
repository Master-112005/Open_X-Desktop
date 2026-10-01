'use strict';

const ReasoningDiagnostics = require('./ReasoningDiagnostics');
const { deepFreeze } = require('../shared/UtilsCore');
const PipelineStage = require('../pipeline/PipelineStage');
const StageResult = require('../pipeline/StageResult');

class ReasoningError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = details.context || null;
    this.diagnostics = details.diagnostics || [];
    this.code = details.code || this.constructor.name;
    this.timestamp = Date.now();
    if (details.cause) this.cause = details.cause;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      diagnostics: this.diagnostics,
      timestamp: this.timestamp
    };
  }
}

class InferenceError extends ReasoningError {}
class GoalReasoningError extends ReasoningError {}
class IntentReasoningError extends ReasoningError {}
class ActionReasoningError extends ReasoningError {}
class ConflictError extends ReasoningError {}
class ClarificationError extends ReasoningError {}
class ConfigurationError extends ReasoningError {}
class PipelineError extends ReasoningError {}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function clamp(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function rounded(value) {
  return Number(clamp(value).toFixed(3));
}

function scoreLabel(score) {
  if (score >= 0.75) return 'high';
  if (score >= 0.45) return 'medium';
  return score > 0 ? 'low' : 'none';
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function average(values) {
  const filtered = values.filter(Number.isFinite);
  if (filtered.length === 0) return 0;
  return Number((filtered.reduce((sum, value) => sum + value, 0) / filtered.length).toFixed(3));
}

const SENSITIVE_METADATA = /(?:password|token|secret|key|otp|pin|phone|email|privateKey|session)/i;

function cleanMetadata(value, depth = 0) {
  if (!value || typeof value !== 'object') return value;
  if (depth > 2) return '[Object]';
  if (Array.isArray(value)) return value.slice(0, 12).map(item => cleanMetadata(item, depth + 1));
  const next = {};
  for (const [key, item] of Object.entries(value)) {
    next[key] = SENSITIVE_METADATA.test(key) ? '[REDACTED]' : cleanMetadata(item, depth + 1);
  }
  return next;
}

function itemKey(item = {}) {
  return item.id || item.intent || item.action || item.task || item.requirement || item.type || item.value || '';
}

function sortByConfidence(list = []) {
  return list.slice().sort((left, right) =>
    (Number(right.confidence) || 0) - (Number(left.confidence) || 0) ||
    String(itemKey(left)).localeCompare(String(itemKey(right)))
  );
}

const DEFAULT_REASONER_OPTIONS = Object.freeze({
  enabled: true,
  priority: 100,
  confidenceThreshold: 0.45,
  strategy: 'deterministic'
});

class ReasoningConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || '8.0.0');
    this.strict = input.strict === true;
    this.confidenceThreshold = Math.max(0, Math.min(1, Number(input.confidenceThreshold ?? 0.45)));
    this.strategy = String(input.strategy || 'deterministic');
    this.maxCandidates = Number.isFinite(input.maxCandidates) ? Math.max(1, Number(input.maxCandidates)) : 25;
    this.maxEvidence = Number.isFinite(input.maxEvidence) ? Math.max(25, Number(input.maxEvidence)) : 160;
    this.graphMaxNodes = Number.isFinite(input.graphMaxNodes) ? Math.max(40, Number(input.graphMaxNodes)) : 220;
    this.graphMaxEdges = Number.isFinite(input.graphMaxEdges) ? Math.max(60, Number(input.graphMaxEdges)) : 360;
    this.reasonerWarningMs = Number.isFinite(input.reasonerWarningMs) ? Math.max(1, Number(input.reasonerWarningMs)) : 75;
    this.contextBoost = Math.max(0, Math.min(0.25, Number(input.contextBoost ?? 0.08)));
    this.entityBoost = Math.max(0, Math.min(0.25, Number(input.entityBoost ?? 0.1)));
    this.cognitiveSignalBoost = Math.max(0, Math.min(0.25, Number(input.cognitiveSignalBoost ?? 0.05)));
    this.deliberationBoost = Math.max(0, Math.min(0.25, Number(input.deliberationBoost ?? 0.08)));
    this.ambiguityPenalty = Math.max(0, Math.min(0.25, Number(input.ambiguityPenalty ?? 0.08)));
    this.reasoners = { ...(input.reasoners || {}) };
    this.providers = { ...(input.providers || {}) };
  }

  getReasonerOptions(id, defaults = {}) {
    return {
      ...DEFAULT_REASONER_OPTIONS,
      ...(defaults || {}),
      ...(this.reasoners[String(id || '')] || {})
    };
  }

  toJSON() {
    return {
      enabled: this.enabled,
      version: this.version,
      strict: this.strict,
      confidenceThreshold: this.confidenceThreshold,
      strategy: this.strategy,
      maxCandidates: this.maxCandidates,
      maxEvidence: this.maxEvidence,
      graphMaxNodes: this.graphMaxNodes,
      graphMaxEdges: this.graphMaxEdges,
      reasonerWarningMs: this.reasonerWarningMs,
      contextBoost: this.contextBoost,
      entityBoost: this.entityBoost,
      cognitiveSignalBoost: this.cognitiveSignalBoost,
      deliberationBoost: this.deliberationBoost,
      ambiguityPenalty: this.ambiguityPenalty,
      reasoners: { ...this.reasoners }
    };
  }
}

class ReasoningLogger {
  constructor(logger = null) {
    this.logger = logger || null;
  }

  _safeData(data, depth = 0) {
    if (!data || typeof data !== 'object') return data;
    if (depth > 3) return '[Object]';
    if (Array.isArray(data)) return data.slice(0, 30).map(item => this._safeData(item, depth + 1));
    const copy = {};
    for (const [key, value] of Object.entries(data)) {
      copy[key] = /(password|token|secret|private|key|email|phone|otp|pin|session)/i.test(key)
        ? '[REDACTED]'
        : this._safeData(value, depth + 1);
    }
    return copy;
  }

  debug(message, data) { this.logger?.debug?.(message, this._safeData(data)); }
  info(message, data) { this.logger?.info?.(message, this._safeData(data)); }
  warn(message, data) { this.logger?.warn?.(message, this._safeData(data)); }
  error(message, data) { this.logger?.error?.(message, this._safeData(data)); }
}

class ReasoningResult {
  constructor(input = {}) {
    this.resolvedGoal = input.resolvedGoal || null;
    this.candidateGoals = Array.isArray(input.candidateGoals) ? input.candidateGoals.slice() : [];
    this.resolvedIntent = input.resolvedIntent || null;
    this.candidateIntents = Array.isArray(input.candidateIntents) ? input.candidateIntents.slice() : [];
    this.resolvedAction = input.resolvedAction || null;
    this.candidateActions = Array.isArray(input.candidateActions) ? input.candidateActions.slice() : [];
    this.candidateTasks = Array.isArray(input.candidateTasks) ? input.candidateTasks.slice() : [];
    this.missingInformation = Array.isArray(input.missingInformation) ? input.missingInformation.slice() : [];
    this.clarificationRequirements = Array.isArray(input.clarificationRequirements) ? input.clarificationRequirements.slice() : [];
    this.detectedConflicts = Array.isArray(input.detectedConflicts) ? input.detectedConflicts.slice() : [];
    this.reasoningGraph = input.reasoningGraph || { nodes: [], edges: [] };
    this.confidenceScores = { ...(input.confidenceScores || {}) };
    this.evidence = Array.isArray(input.evidence) ? input.evidence.slice() : [];
    this.diagnostics = input.diagnostics || {};
    this.metadata = { ...(input.metadata || {}) };
    this.entitySummary = { ...(input.entitySummary || {}) };
    this.ready = Boolean(this.resolvedGoal && this.resolvedIntent && this.resolvedAction && this.clarificationRequirements.length === 0);
    this.timing = { ...(input.timing || {}) };
    this.version = String(input.version || '8.0.0');
    this.cognitiveReasoning = input.cognitiveReasoning || input.futureExtensions?.cognitiveReasoning || null;
    this.futureExtensions = { ...(input.futureExtensions || {}) };
    deepFreeze(this);
  }
}

class ReasoningContext {
  constructor({ resolvedContext = null, configuration = null, metadata = {} } = {}) {
    this.resolvedContext = resolvedContext || null;
    this.configuration = configuration || null;
    this.metadata = { ...(metadata || {}) };
    this.input = String(metadata.rawInput || resolvedContext?.metadata?.rawInput || resolvedContext?.metadata?.input || '');
    this.normalizedInput = normalize(this.input);
    this.structuredEntities = metadata.structuredEntities || resolvedContext?.structuredEntities || resolvedContext?.futureExtensions?.structuredEntities || null;
    this.entitySummary = this._summarizeEntities(this.structuredEntities);
    this.inferences = [];
    this.candidateGoals = [];
    this.candidateIntents = [];
    this.candidateActions = [];
    this.candidateTasks = [];
    this.missingInformation = [];
    this.clarificationRequirements = [];
    this.detectedConflicts = [];
    this.evidence = [];
    this.confidenceScores = {};
    this.reasoningGraph = { nodes: [], edges: [] };
    this.diagnostics = new ReasoningDiagnostics();
    this.timing = { startedAt: Date.now(), finishedAt: null, durationMs: 0 };
    this.futureExtensions = {};
  }

  has(pattern) {
    return pattern.test(this.normalizedInput);
  }

  addEvidence(type, value, confidence = 0.6, source = '', metadata = {}) {
    const evidence = {
      type: String(type || 'evidence'),
      value: String(value || ''),
      confidence: Math.max(0, Math.min(1, Number(confidence) || 0)),
      source: String(source || ''),
      metadata: { ...(metadata || {}) }
    };
    this.evidence.push(evidence);
    const limit = this.configuration?.maxEvidence || 160;
    if (this.evidence.length > limit) this.evidence.splice(0, this.evidence.length - limit);
    return evidence;
  }

  _candidateKey(item = {}) {
    return item.id || item.name || item.action || item.intent || item.task || item.field || item.requirement || JSON.stringify(item);
  }

  addUnique(listName, item) {
    const list = this[listName];
    const key = this._candidateKey(item);
    const existing = list.find(candidate => this._candidateKey(candidate) === key);
    if (existing) {
      existing.confidence = Math.max(existing.confidence || 0, item.confidence || 0);
      existing.evidence = Array.from(new Set([...(existing.evidence || []), ...(item.evidence || [])]));
      existing.metadata = { ...(existing.metadata || {}), ...(item.metadata || {}) };
      return existing;
    }
    list.push(item);
    return item;
  }

  addTask(task) {
    return this.addUnique('candidateTasks', task);
  }

  addMissing(item) {
    return this.addUnique('missingInformation', item);
  }

  addClarification(item) {
    return this.addUnique('clarificationRequirements', item);
  }

  addConflict(item) {
    return this.addUnique('detectedConflicts', item);
  }

  _summarizeEntities(structured) {
    if (!structured) return {};
    const collections = ['applications', 'browsers', 'files', 'folders', 'websites', 'contacts', 'people', 'devices', 'media', 'dates', 'times', 'durations', 'reminders', 'alarms', 'timers', 'locations', 'windows', 'networks', 'volumeLevels', 'brightnessLevels'];
    return Object.fromEntries(collections.map(collection => [collection, Array.isArray(structured[collection]) ? structured[collection].length : 0]).filter(([, count]) => count > 0));
  }

  compact() {
    for (const listName of ['candidateGoals', 'candidateIntents', 'candidateActions', 'candidateTasks', 'missingInformation', 'clarificationRequirements', 'detectedConflicts']) {
      const next = [];
      const byKey = new Map();
      for (const item of this[listName]) {
        const key = this._candidateKey(item);
        const existing = byKey.get(key);
        if (!existing) {
          next.push(item);
          byKey.set(key, item);
          continue;
        }
        existing.confidence = Math.max(existing.confidence || 0, item.confidence || 0);
        existing.evidence = Array.from(new Set([...(existing.evidence || []), ...(item.evidence || [])]));
        existing.metadata = { ...(existing.metadata || {}), ...(item.metadata || {}) };
      }
      this[listName] = next;
    }
    return this;
  }

  ranked(listName) {
    return this[listName].slice().sort((left, right) =>
      (Number(right.confidence) || 0) - (Number(left.confidence) || 0) ||
      String(left.id || left.name || left.action || left.intent || left.task).localeCompare(String(right.id || right.name || right.action || right.intent || right.task))
    );
  }

  toReasoningResult() {
    this.compact();
    this.timing.finishedAt = this.timing.finishedAt || Date.now();
    this.timing.durationMs = Math.max(0, this.timing.finishedAt - this.timing.startedAt);
    const goals = this.ranked('candidateGoals');
    const intents = this.ranked('candidateIntents');
    const actions = this.ranked('candidateActions');
    return new ReasoningResult({
      resolvedGoal: goals[0] || null,
      candidateGoals: goals,
      resolvedIntent: intents[0] || null,
      candidateIntents: intents,
      resolvedAction: actions[0] || null,
      candidateActions: actions,
      candidateTasks: this.candidateTasks.slice(),
      missingInformation: this.missingInformation.slice(),
      clarificationRequirements: this.clarificationRequirements.slice(),
      detectedConflicts: this.detectedConflicts.slice(),
      reasoningGraph: this.reasoningGraph,
      confidenceScores: this.confidenceScores,
      evidence: this.evidence,
      diagnostics: this.diagnostics.toJSON(),
      metadata: this.metadata,
      entitySummary: this.entitySummary,
      timing: this.timing,
      version: this.configuration?.version || '8.0.0',
      cognitiveReasoning: this.futureExtensions.cognitiveReasoning || null,
      futureExtensions: this.futureExtensions
    });
  }
}

class ReasoningRegistry {
  constructor() {
    this.reasoners = new Map();
  }

  register(reasoner, options = {}) {
    if (!reasoner || typeof reasoner.reason !== 'function') {
      throw new ConfigurationError('Reasoner must provide reason(context).');
    }
    const id = String(options.id || reasoner.id || reasoner.constructor?.name || '').trim();
    if (!id) throw new ConfigurationError('Reasoner id is required.');
    reasoner.id = id;
    if (Number.isFinite(options.priority)) reasoner.priority = Number(options.priority);
    if (options.enabled !== undefined) reasoner.enabled = options.enabled !== false;
    this.reasoners.set(id, reasoner);
    return this;
  }

  get(id) {
    return this.reasoners.get(String(id || '').trim()) || null;
  }

  unregister(id) {
    return this.reasoners.delete(String(id || '').trim());
  }

  list({ includeDisabled = true } = {}) {
    return [...this.reasoners.values()]
      .filter(reasoner => includeDisabled || reasoner.enabled !== false)
      .sort((left, right) => (Number(left.priority) || 0) - (Number(right.priority) || 0) || String(left.id).localeCompare(String(right.id)));
  }

  health() {
    return this.list().map(reasoner => ({
      id: reasoner.id,
      version: reasoner.version,
      priority: reasoner.priority,
      enabled: reasoner.enabled !== false,
      initialized: reasoner.initialized === true
    }));
  }

  clear() {
    const count = this.reasoners.size;
    this.reasoners.clear();
    return count;
  }
}

class ReasoningPipeline {
  constructor(options = {}) {
    this.registry = options.registry || new ReasoningRegistry();
    this.configuration = options.configuration instanceof ReasoningConfiguration
      ? options.configuration
      : new ReasoningConfiguration(options.configuration || {});
    this.logger = options.logger || null;
  }

  async run(resolvedContext, options = {}) {
    const context = new ReasoningContext({
      resolvedContext,
      configuration: this.configuration,
      metadata: options.metadata || {}
    });
    if (this.configuration.enabled === false) return context.toReasoningResult();

    const reasoners = this.registry.list({ includeDisabled: false });
    context.diagnostics.reasonerCount = reasoners.length;

    for (const reasoner of reasoners) {
      const started = Date.now();
      context.diagnostics.pipelineOrder.push(reasoner.id);
      try {
        if (!reasoner.initialized && typeof reasoner.initialize === 'function') await reasoner.initialize();
        if (reasoner.supports(context)) await reasoner.reason(context);
        context.compact();
        this._trimCandidates(context);
      } catch (error) {
        const wrapped = new PipelineError(`Reasoner failed: ${reasoner.id}`, { cause: error, context: { reasonerId: reasoner.id } });
        context.diagnostics.error(wrapped);
        if (this.configuration.strict) throw wrapped;
      } finally {
        const durationMs = Date.now() - started;
        context.diagnostics.time(reasoner.id, durationMs);
        if (durationMs > (this.configuration.reasonerWarningMs || 75)) {
          context.diagnostics.warn('Reasoner exceeded expected duration.', {
            reasonerId: reasoner.id,
            durationMs
          });
        }
        if (typeof reasoner.cleanup === 'function') await reasoner.cleanup(context);
      }
    }

    return context.toReasoningResult();
  }

  _trimCandidates(context) {
    const limit = context.configuration?.maxCandidates || 25;
    for (const listName of ['candidateGoals', 'candidateIntents', 'candidateActions', 'candidateTasks']) {
      if (context[listName].length <= limit) continue;
      context.diagnostics.trimmedCandidates[listName] = (context.diagnostics.trimmedCandidates[listName] || 0) + (context[listName].length - limit);
      context[listName] = context.ranked(listName).slice(0, limit);
    }
  }
}

class ReasoningManager {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof ReasoningConfiguration
      ? options.configuration
      : new ReasoningConfiguration(options.configuration || options);
    this.registry = options.registry || new ReasoningRegistry();
    this.pipeline = options.pipeline || null;
    this.logger = options.logger || null;
    if (options.defaultReasoners !== false) this._registerDefaults();
  }

  _registerDefaults() {
    [
      [InferenceEngine, 'reasoning.inferenceEngine', 10],
      [CognitiveReasoner, 'reasoning.cognitiveReasoner', 15],
      [GoalReasoner, 'reasoning.goalReasoner', 20],
      [IntentReasoner, 'reasoning.intentReasoner', 30],
      [ActionReasoner, 'reasoning.actionReasoner', 40],
      [TaskReasoner, 'reasoning.taskReasoner', 50],
      [ContextReasoner, 'reasoning.contextReasoner', 60],
      [DeliberationReasoner, 'reasoning.deliberationReasoner', 65],
      [ConflictResolver, 'reasoning.conflictResolver', 70],
      [ClarificationEngine, 'reasoning.clarificationEngine', 80],
      [ConfidenceManager, 'reasoning.confidenceManager', 90],
      [ReasoningGraphBuilder, 'reasoning.graphBuilder', 100]
    ].forEach(([Ctor, id, priority]) => {
      const configured = this.configuration.getReasonerOptions(id, { priority });
      this.registry.register(new Ctor({ id, ...configured }), { id, priority: configured.priority, enabled: configured.enabled });
    });
  }

  registerReasoner(reasoner, options = {}) {
    this.registry.register(reasoner, options);
    return this;
  }

  async reason(resolvedContext, options = {}) {
    if (!this.pipeline) {
      this.pipeline = new ReasoningPipeline({
        registry: this.registry,
        configuration: this.configuration,
        logger: this.logger
      });
    }
    return this.pipeline.run(resolvedContext, options);
  }

  getStatus() {
    return {
      enabled: this.configuration.enabled,
      version: this.configuration.version,
      pipelineReady: Boolean(this.pipeline),
      reasonerCount: this.registry.list().length,
      reasoners: this.registry.health()
    };
  }

  destroy() {
    for (const reasoner of this.registry.list()) reasoner.destroy?.();
    this.registry.clear();
    this.pipeline = null;
  }
}

function createDefaultReasoningManager(options = {}) {
  return new ReasoningManager(options);
}

class BaseReasoner {
  constructor(options = {}) {
    this.id = String(options.id || this.constructor.name);
    this.name = String(options.name || this.id);
    this.priority = Number.isFinite(options.priority) ? Number(options.priority) : 100;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.options = { ...(options || {}) };
    this.initialized = false;
  }

  initialize() {
    this.initialized = true;
    return true;
  }

  supports(context) {
    return this.enabled && !!context;
  }

  reason(context) {
    return context;
  }

  cleanup() {
    return true;
  }

  text(context) {
    return String(context?.normalizedInput || context?.input || '').toLowerCase().trim();
  }

  hasAny(context, patterns = []) {
    const text = this.text(context);
    return patterns.some(pattern => pattern instanceof RegExp ? pattern.test(text) : text.includes(String(pattern).toLowerCase()));
  }

  entities(context, collection = null) {
    const structured = context?.structuredEntities || context?.metadata?.structuredEntities || context?.resolvedContext?.structuredEntities || null;
    if (!structured) return collection ? [] : {};
    if (collection) return Array.isArray(structured[collection]) ? structured[collection] : [];
    return structured;
  }

  bestEntity(context, collection) {
    return this.entities(context, collection).slice().sort((left, right) => (right.confidence || 0) - (left.confidence || 0))[0] || null;
  }

  entityValue(context, collection) {
    const entity = this.bestEntity(context, collection);
    return entity ? (entity.canonical || entity.value || null) : null;
  }

  confidence(value, fallback = 0.6) {
    return Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : fallback));
  }

  destroy() {
    this.initialized = false;
    return true;
  }
}

const INFERENCE_RULES = Object.freeze([
  { pattern: /\b(?:i'?m|im|i am|feel|feeling|fealing)\s+(?:cold|chilly|freezing|hot|overheated|thirsty|thursty|hungry|hungery)\b|\btoo (?:cold|hot)\b/, inference: 'environmental-adjustment', confidence: 0.68 },
  { pattern: /\b(?:i'?m|im|i am|feel|feeling|fealing)\s+(?:tired|tried|tierd|sleepy|exhausted|drained|stressed|stressd|anxious|anxous|worried|sad|upset|confused|confuzed)\b/, inference: 'wellbeing-support', confidence: 0.7 },
  { pattern: /\btoo loud\b|\bit'?s loud\b|\bvolume is high\b/, inference: 'audio-adjustment', confidence: 0.72 },
  { pattern: /\bfinish my assignment\b|\bwork on my assignment\b|\bneed to work\b/, inference: 'productivity-support', confidence: 0.66 },
  { pattern: /\blisten to music\b|\bplay music\b|\bsong\b/, inference: 'media-playback', confidence: 0.78 },
  { pattern: /\bsend (?:my )?(?:report|document|file)\b/, inference: 'send-document', confidence: 0.74 },
  { pattern: /\b(?:remind|reminder|notify|alert)\b/, inference: 'reminder-scheduling', confidence: 0.78 },
  { pattern: /\b(?:alarm|wake me)\b/, inference: 'alarm-scheduling', confidence: 0.78 },
  { pattern: /\b(?:timer|countdown|pomodoro)\b/, inference: 'timer-scheduling', confidence: 0.78 },
  { pattern: /\b(?:search|google|look up|what is|who is|how to)\b/, inference: 'information-request', confidence: 0.74 },
  { pattern: /\b(?:no no|actually|instead|set it to|change it to)\b/, inference: 'correction-or-revision', confidence: 0.7 },
  { pattern: /\b(?:send|share|transfer|copy|move).*\b(?:phone|mobile|laptop|computer)\b/, inference: 'device-transfer', confidence: 0.76 }
]);

class InferenceEngine extends BaseReasoner {
  reason(context) {
    for (const rule of INFERENCE_RULES) {
      if (!rule.pattern.test(context.normalizedInput)) continue;
      context.inferences.push({ inference: rule.inference, confidence: rule.confidence, source: this.id });
      context.addEvidence('inference', rule.inference, rule.confidence, this.id);
    }
    if (context.entitySummary.media) context.addEvidence('entity.media', 'media-present', 0.76, this.id);
    if (context.entitySummary.reminders) context.addEvidence('entity.reminder', 'reminder-present', 0.78, this.id);
    if (context.entitySummary.alarms) context.addEvidence('entity.alarm', 'alarm-present', 0.78, this.id);
    if (context.entitySummary.timers) context.addEvidence('entity.timer', 'timer-present', 0.78, this.id);
    if (context.entitySummary.volumeLevels) context.addEvidence('entity.volume', 'volume-level-present', 0.78, this.id);
    if (context.entitySummary.files || context.entitySummary.folders || context.entitySummary.paths) context.addEvidence('entity.file', 'file-target-present', 0.74, this.id);
    context.diagnostics.inferenceCount = context.inferences.length;
    return context;
  }
}

const DIMENSIONS = Object.freeze({
  intent: 'Intent Understanding',
  context: 'Context Reasoning',
  personalMemory: 'Personal Memory Reasoning',
  preference: 'User Preference Learning',
  temporal: 'Temporal Reasoning',
  causal: 'Causal Reasoning',
  planning: 'Goal Planning and Execution Reasoning',
  commonSense: 'Common Sense Reasoning',
  emotional: 'Emotional Reasoning',
  conversation: 'Conversation Reasoning',
  knowledge: 'Knowledge Reasoning',
  uncertainty: 'Uncertainty Reasoning',
  decision: 'Decision Reasoning',
  privacy: 'Privacy Reasoning',
  learning: 'Learning Reasoning',
  spatial: 'Spatial Reasoning',
  identity: 'Identity Reasoning',
  multiAgent: 'Multi-Agent Reasoning',
  safety: 'Safety Reasoning',
  selfReflection: 'Self-Reflection Reasoning'
});

const DIMENSION_ORDER = Object.freeze(Object.keys(DIMENSIONS));

const COGNITIVE_RULES = Object.freeze([
  { id: 'intent', evidence: 'goal-language', pattern: /\b(?:want|need|can you|could you|please|help|i am|i'm|i feel|feeling|make|prepare|do)\b/, confidence: 0.68 },
  { id: 'context', evidence: 'context-dependent-language', pattern: /\b(?:this|that|it|them|there|here|current|same|again|now)\b/, confidence: 0.66 },
  { id: 'personalMemory', evidence: 'personal-reference', pattern: /\b(?:my|mine|usual|normally|favorite|favourite|routine|again|same)\b/, confidence: 0.66 },
  { id: 'preference', evidence: 'preference-language', pattern: /\b(?:i like|i prefer|favorite|favourite|always|usually|normally|every day|daily|habit|routine)\b/, confidence: 0.7 },
  { id: 'temporal', evidence: 'time-language', pattern: /\b(?:today|tomorrow|yesterday|tonight|morning|evening|night|early|late|later|soon|after|before|in \d+|at \d+|am|pm|daily|every)\b/, confidence: 0.72 },
  { id: 'causal', evidence: 'cause-effect-language', pattern: /\b(?:because|why|reason|problem|issue|not working|failed|slow|lag|uncomfortable|too hot|too cold|too loud|too bright)\b/, confidence: 0.68 },
  { id: 'planning', evidence: 'multi-step-language', pattern: /\b(?:prepare|plan|planning|routine|first|then|after that|and then|before|schedule|organize|setup|set up)\b/, confidence: 0.7 },
  { id: 'commonSense', evidence: 'human-situation-language', pattern: /\b(?:leaving home|going out|sleep|tired|tried|tierd|hungry|thirsty|cold|hot|sick|unwell|exam|meeting|work|study|morning routine|night routine)\b/, confidence: 0.62 },
  { id: 'emotional', evidence: 'emotion-language', pattern: /\b(?:sad|happy|angry|tired|tried|tierd|stressed|stressd|worried|failed|excited|upset|lonely|afraid|anxious|anxous|confused|feeling|fealing)\b/, confidence: 0.72 },
  { id: 'conversation', evidence: 'dialogue-reference', pattern: /\b(?:it|that|them|those|same|again|yes|no|actually|instead|book it|close it|cancel it)\b/, confidence: 0.72 },
  { id: 'knowledge', evidence: 'knowledge-request', pattern: /\b(?:what|who|where|when|why|how|find|search|photos?|pictures?|trip|information|explain|tell me)\b/, confidence: 0.66 },
  { id: 'uncertainty', evidence: 'ambiguous-language', pattern: /\b(?:something|anything|somewhere|someone|some one|early|later|soon|maybe|probably|my meeting|the file|the app|it|that|them)\b/, confidence: 0.64 },
  { id: 'decision', evidence: 'choice-language', pattern: /\b(?:should i|which|best|better|choose|buy|compare|recommend|worth it|option)\b/, confidence: 0.7 },
  { id: 'privacy', evidence: 'sensitive-data-language', pattern: /\b(?:password|pin|otp|private|secret|personal|photo|photos|message|chat|account|delete history|clear history|location)\b/, confidence: 0.72 },
  { id: 'learning', evidence: 'learnable-preference-language', pattern: /\b(?:i like|i prefer|remember that|always|usually|daily|every day|routine|habit|from now)\b/, confidence: 0.68 },
  { id: 'spatial', evidence: 'place-language', pattern: /\b(?:home|office|room|kitchen|bedroom|desk|near|nearby|around me|outside|inside|folder|directory|location)\b/, confidence: 0.66 },
  { id: 'identity', evidence: 'person-reference', pattern: /\b(?:mom|mummy|mother|dad|daddy|father|friend|brother|sister|wife|husband|call|message|send|person|people)\b/, confidence: 0.68 },
  { id: 'multiAgent', evidence: 'workflow-coordination-language', pattern: /\b(?:coordinate|plan my trip|prepare my routine|send.*remind|calendar.*message|message.*calendar|book.*remind)\b/, confidence: 0.62 },
  { id: 'safety', evidence: 'risky-action-language', pattern: /\b(?:delete all|remove all|erase all|format|shutdown|restart|sign out|send.*password|share.*private|close all)\b/, confidence: 0.78 },
  { id: 'selfReflection', evidence: 'requires-self-check', pattern: /\b(?:are you sure|correctly|confirm|verify|can you do this|is this safe|should i)\b/, confidence: 0.66 }
]);

const ENTITY_DIMENSIONS = Object.freeze({
  dates: ['temporal'],
  times: ['temporal'],
  durations: ['temporal'],
  reminders: ['temporal', 'planning'],
  alarms: ['temporal', 'planning'],
  timers: ['temporal', 'planning'],
  contacts: ['identity', 'conversation', 'privacy'],
  people: ['identity', 'knowledge', 'privacy'],
  locations: ['spatial', 'context'],
  devices: ['context', 'spatial'],
  files: ['knowledge', 'privacy'],
  folders: ['spatial', 'knowledge'],
  paths: ['spatial', 'privacy'],
  media: ['preference', 'knowledge'],
  applications: ['context'],
  websites: ['knowledge']
});

const HIDDEN_INTENT_RULES = Object.freeze([
  {
    id: 'wellbeing.rest',
    pattern: /\b(?:i am|i'm|im|i feel|feeling|fealing)\s+(?:tired|tried|tierd|sleepy|exhausted|drained|stressed|stressd|anxious|anxous|worried|overwhelmed|sad|upset)\b/,
    confidence: 0.72,
    alternatives: ['rest support', 'schedule adjustment', 'light workload', 'supportive response']
  },
  {
    id: 'environment.comfort',
    pattern: /\b(?:i\s+am|i'm|im|i\s+feel|feeling|fealing|feel)\s+(?:cold|chilly|freezing|hot|overheated|uncomfortable|thirsty|thursty|hungry|hungery)\b|\b(?:room|place|desk|environment|it)\s+(?:feels|is)\s+(?:uncomfortable|hot|cold|dark|bright|loud|noisy)\b|\btoo\s+(?:hot|cold|dark|bright|loud|noisy)\b/,
    confidence: 0.7,
    alternatives: ['adjust environment', 'diagnose comfort issue', 'ask for affected device']
  },
  {
    id: 'routine.execution',
    pattern: /\b(?:morning|night|study|work|sleep)\s+routine\b|\bprepare my\b/,
    confidence: 0.7,
    alternatives: ['decompose routine', 'schedule tasks', 'use learned preferences']
  },
  {
    id: 'decision.support',
    pattern: /\b(?:should i|which one|best|better|recommend|worth it|compare)\b/,
    confidence: 0.72,
    alternatives: ['compare trade-offs', 'ask constraints', 'rank options']
  },
  {
    id: 'identity.communication',
    pattern: /\b(?:tell|ask|message|send|call)\s+(?:mom|mummy|dad|daddy|friend|brother|sister|[a-z][a-z0-9._-]{2,})\b/,
    confidence: 0.72,
    alternatives: ['resolve person', 'choose channel', 'confirm message content']
  }
]);

const PRIVACY_ACTIONS = new Set(['TRANSFER_FILE', 'DELETE_FILE', 'MOVE_FILE', 'SEND_MESSAGE']);
const SAFETY_ACTIONS = new Set(['DELETE_FILE', 'DELETE_FOLDER', 'SYSTEM_SHUTDOWN', 'SYSTEM_RESTART', 'FORMAT_DRIVE']);

class CognitiveReasoner extends BaseReasoner {
  reason(context) {
    const dimensions = new Map();
    const addDimension = (id, confidence, evidence, metadata = {}) => {
      if (!DIMENSIONS[id]) return null;
      const existing = dimensions.get(id) || {
        id,
        name: DIMENSIONS[id],
        confidence: 0,
        evidence: [],
        metadata: {}
      };
      existing.confidence = Math.max(existing.confidence, clamp(confidence));
      existing.evidence = unique([...existing.evidence, evidence]);
      existing.metadata = { ...existing.metadata, ...(metadata || {}) };
      dimensions.set(id, existing);
      context.addEvidence(`reasoning.${id}`, evidence, confidence, this.id);
      return existing;
    };

    this._addPatternDimensions(context, addDimension);
    this._addEntityDimensions(context, addDimension);
    this._addContextDimensions(context, addDimension);

    const hiddenIntents = this._hiddenIntents(context);
    for (const intent of hiddenIntents) {
      context.addEvidence('reasoning.hidden-intent', intent.id, intent.confidence, this.id);
      this._addInference(context, intent.id);
      if (intent.id.startsWith('wellbeing.')) addDimension('emotional', intent.confidence, 'hidden-wellbeing-intent');
      if (intent.id.startsWith('environment.')) addDimension('causal', intent.confidence, 'hidden-environment-intent');
      if (intent.id.startsWith('routine.')) addDimension('planning', intent.confidence, 'hidden-routine-intent');
      if (intent.id.startsWith('decision.')) addDimension('decision', intent.confidence, 'hidden-decision-intent');
      if (intent.id.startsWith('identity.')) addDimension('identity', intent.confidence, 'hidden-identity-intent');
    }

    const rankedDimensions = this._rankDimensions(dimensions);
    const uncertainty = this._uncertainty(context, rankedDimensions);
    const safety = this._safety(context, rankedDimensions);
    const privacy = this._privacy(context, rankedDimensions);
    const learning = this._learning(context, rankedDimensions);
    const selfReflection = this._selfReflection(context, uncertainty, safety, privacy);

    if (uncertainty.score > 0) {
      context.addEvidence('reasoning.uncertainty-score', uncertainty.level, uncertainty.score, this.id);
      this._addInference(context, 'uncertainty-detected');
    }
    if (safety.score > 0) {
      context.addEvidence('reasoning.safety-score', safety.level, safety.score, this.id);
      this._addInference(context, 'safety-risk');
    }
    if (privacy.score > 0) {
      context.addEvidence('reasoning.privacy-score', privacy.level, privacy.score, this.id);
      this._addInference(context, 'privacy-sensitive');
    }
    if (learning.shouldLearn) {
      context.addEvidence('reasoning.learning-signal', learning.reason, learning.score, this.id);
      this._addInference(context, 'learning-opportunity');
    }
    if (uncertainty.requiresClarification) {
      context.addMissing({
        field: uncertainty.field,
        confidence: uncertainty.score,
        source: this.id
      });
      context.addClarification({
        requirement: 'resolve-uncertainty',
        field: uncertainty.field,
        confidence: uncertainty.score,
        source: this.id,
        reason: uncertainty.reason
      });
    }

    const summary = {
      version: '1.0.0',
      strategy: 'deterministic-cognitive-signal-layer',
      dimensions: rankedDimensions,
      hiddenIntents,
      uncertainty,
      safety,
      privacy,
      learning,
      selfReflection
    };
    context.futureExtensions.cognitiveReasoning = summary;
    context.diagnostics.cognitiveReasoning = {
      dimensions: rankedDimensions.length,
      hiddenIntents: hiddenIntents.length,
      uncertainty: uncertainty.level,
      safety: safety.level,
      privacy: privacy.level,
      shouldLearn: learning.shouldLearn
    };
    return context;
  }

  _addPatternDimensions(context, addDimension) {
    for (const rule of COGNITIVE_RULES) {
      if (!rule.pattern.test(context.normalizedInput)) continue;
      addDimension(rule.id, rule.confidence, rule.evidence);
    }
  }

  _addEntityDimensions(context, addDimension) {
    for (const [collection, dimensionIds] of Object.entries(ENTITY_DIMENSIONS)) {
      const count = Number(context.entitySummary?.[collection] || 0);
      if (count <= 0) continue;
      const confidence = Math.min(0.82, 0.6 + (count * 0.04));
      for (const id of dimensionIds) {
        addDimension(id, confidence, `entity:${collection}`, { [`${collection}Count`]: count });
      }
    }
  }

  _addContextDimensions(context, addDimension) {
    const resolved = context.resolvedContext || {};
    if (resolved.hasContext?.() || Object.keys(resolved.workingMemory || {}).length > 0 || Object.keys(resolved.conversationMemory || {}).length > 0) {
      addDimension('context', 0.74, 'resolved-context-present');
      addDimension('conversation', 0.7, 'conversation-memory-present');
    }
    if (resolved.user?.hasProfile || Object.keys(resolved.user?.preferences || {}).length > 0) {
      addDimension('personalMemory', 0.72, 'user-profile-present');
      addDimension('preference', 0.72, 'user-preferences-present');
    }
    if (resolved.time?.currentDate || resolved.time?.localTime || resolved.calendar?.events?.length) {
      addDimension('temporal', 0.7, 'time-or-calendar-context-present');
    }
    if (resolved.application?.focusedApplication || resolved.browserState?.currentBrowser || resolved.media?.active) {
      addDimension('context', 0.72, 'active-surface-present');
    }
    if (resolved.runningApplications?.length || resolved.devices?.length || resolved.system?.platform) {
      addDimension('context', 0.66, 'device-state-present');
    }
  }

  _hiddenIntents(context) {
    const intents = [];
    for (const rule of HIDDEN_INTENT_RULES) {
      if (!rule.pattern.test(context.normalizedInput)) continue;
      intents.push({
        id: rule.id,
        confidence: rule.confidence,
        alternatives: rule.alternatives.slice()
      });
    }
    return intents;
  }

  _rankDimensions(dimensions) {
    return DIMENSION_ORDER
      .map(id => dimensions.get(id))
      .filter(Boolean)
      .map(item => ({
        id: item.id,
        name: item.name,
        confidence: Number(item.confidence.toFixed(3)),
        evidence: item.evidence.slice(0, 8),
        metadata: { ...item.metadata }
      }))
      .sort((left, right) => right.confidence - left.confidence || DIMENSION_ORDER.indexOf(left.id) - DIMENSION_ORDER.indexOf(right.id));
  }

  _uncertainty(context, dimensions) {
    const text = context.normalizedInput;
    const hasReferences = Boolean(
      context.resolvedContext?.resolvedReferences?.length ||
      context.resolvedContext?.resolvedPronouns?.length ||
      context.resolvedContext?.getRecentReference?.()
    );
    const hasActionableEntity = Boolean(
      context.entitySummary.applications ||
      context.entitySummary.files ||
      context.entitySummary.folders ||
      context.entitySummary.contacts ||
      context.entitySummary.people ||
      context.entitySummary.media ||
      context.entitySummary.times ||
      context.entitySummary.durations
    );
    const vagueReference = /\b(?:it|that|them|this|same)\b/.test(text) && !hasReferences && !hasActionableEntity;
    const vagueTime = /\b(?:early|later|soon|sometime|when i can)\b/.test(text) && !(context.entitySummary.times || context.entitySummary.durations || context.entitySummary.dates);
    const vagueTarget = /\b(?:something|anything|someone|some one|somewhere|my meeting|the file|the app)\b/.test(text) && !hasActionableEntity;
    const needsClarification = vagueReference || vagueTime || vagueTarget;
    const dimensionScore = dimensions.find(item => item.id === 'uncertainty')?.confidence || 0;
    const score = needsClarification ? Math.max(0.72, dimensionScore) : dimensionScore;
    const reason = vagueReference
      ? 'reference target is missing'
      : vagueTime
        ? 'time expression is relative to an unknown preference'
        : vagueTarget
          ? 'target is underspecified'
          : score > 0 ? 'uncertainty language detected' : '';
    return {
      score: Number(score.toFixed(3)),
      level: scoreLabel(score),
      requiresClarification: needsClarification,
      field: vagueTime ? 'timeExpression' : 'target',
      reason
    };
  }

  _safety(context, dimensions) {
    const text = context.normalizedInput;
    const destructive = /\b(?:delete all|remove all|erase all|format|wipe|empty recycle bin|shutdown|restart|sign out|close all)\b/.test(text);
    const irreversible = /\b(?:permanent|forever|without backup|force)\b/.test(text);
    const score = Math.max(
      dimensions.find(item => item.id === 'safety')?.confidence || 0,
      destructive ? 0.84 : 0,
      irreversible ? 0.78 : 0
    );
    return {
      score: Number(score.toFixed(3)),
      level: scoreLabel(score),
      requiresConfirmation: score >= 0.7,
      reason: destructive ? 'destructive or broad command detected' : irreversible ? 'irreversible language detected' : score > 0 ? 'safety-sensitive language detected' : ''
    };
  }

  _privacy(context, dimensions) {
    const text = context.normalizedInput;
    const secret = /\b(?:password|pin|otp|secret|token|private key)\b/.test(text);
    const personal = /\b(?:private|personal|photos?|messages?|chat|account|location|address)\b/.test(text);
    const score = Math.max(
      dimensions.find(item => item.id === 'privacy')?.confidence || 0,
      secret ? 0.9 : 0,
      personal ? 0.72 : 0
    );
    return {
      score: Number(score.toFixed(3)),
      level: scoreLabel(score),
      sensitive: score >= 0.6,
      requiresCare: score >= 0.6,
      reason: secret ? 'secret credential language detected' : personal ? 'personal data language detected' : score > 0 ? 'privacy-sensitive language detected' : ''
    };
  }

  _learning(context, dimensions) {
    const text = context.normalizedInput;
    const explicitPreference = /\b(?:i like|i prefer|my favorite|my favourite|remember that|from now)\b/.test(text);
    const habit = /\b(?:always|usually|daily|every day|routine|habit)\b/.test(text);
    const score = Math.max(
      dimensions.find(item => item.id === 'learning')?.confidence || 0,
      explicitPreference ? 0.74 : 0,
      habit ? 0.7 : 0
    );
    return {
      score: Number(score.toFixed(3)),
      level: scoreLabel(score),
      shouldLearn: score >= 0.68,
      reason: explicitPreference ? 'explicit preference statement' : habit ? 'habit or routine statement' : score > 0 ? 'learnable signal detected' : '',
      memoryType: explicitPreference ? 'preference' : habit ? 'routine' : null
    };
  }

  _selfReflection(context, uncertainty, safety, privacy) {
    const shouldReview = uncertainty.score >= 0.65 || safety.score >= 0.7 || privacy.score >= 0.7;
    return {
      required: shouldReview,
      checks: unique([
        uncertainty.score >= 0.65 ? 'clarify ambiguity before acting' : '',
        safety.score >= 0.7 ? 'require confirmation for risky action' : '',
        privacy.score >= 0.7 ? 'avoid exposing sensitive data' : ''
      ]),
      confidenceAdjustment: Number((-(uncertainty.score * 0.04) - (safety.score * 0.03) - (privacy.score * 0.02)).toFixed(3))
    };
  }

  _addInference(context, inference) {
    if (!inference || context.inferences.some(item => item.inference === inference && item.source === this.id)) return;
    context.inferences.push({
      inference,
      confidence: 0.68,
      source: this.id
    });
  }

  static riskForAction(action, cognitive) {
    const risk = {};
    const safety = cognitive?.safety || {};
    const privacy = cognitive?.privacy || {};
    const uncertainty = cognitive?.uncertainty || {};
    if (safety.requiresConfirmation && SAFETY_ACTIONS.has(action)) {
      risk.risk = 'high';
      risk.dangerous = true;
      risk.requiresConfirmation = true;
      risk.confirmationReason = safety.reason || 'safety-sensitive action requires confirmation';
    }
    if (privacy.sensitive && PRIVACY_ACTIONS.has(action)) {
      risk.privacySensitive = true;
      if (action === 'TRANSFER_FILE' || action === 'SEND_MESSAGE') {
        risk.requiresConfirmation = true;
        risk.confirmationReason = privacy.reason || 'privacy-sensitive action requires confirmation';
      }
    }
    if (uncertainty.requiresClarification) {
      risk.uncertain = true;
      risk.uncertaintyReason = uncertainty.reason;
    }
    return risk;
  }
}

const GOAL_RULES = Object.freeze([
  { id: 'media.playback', name: 'Media Playback', pattern: /\b(?:play|listen|music|song|video|watch)\b/, inference: 'media-playback', confidence: 0.8 },
  { id: 'send.document', name: 'Send Document', pattern: /\b(?:send|share|transfer).*\b(?:report|document|file|pdf)\b/, inference: 'send-document', confidence: 0.78 },
  { id: 'device.transfer', name: 'Device Transfer', pattern: /\b(?:send|share|transfer|copy|move).*\b(?:phone|mobile|laptop|computer)\b/, inference: 'device-transfer', confidence: 0.78 },
  { id: 'productivity', name: 'Productivity', pattern: /\b(?:work|assignment|project|study|productivity)\b/, inference: 'productivity-support', confidence: 0.66 },
  { id: 'application.control', name: 'Application Control', pattern: /\b(?:open|launch|start|close|quit|switch)\b/, confidence: 0.76 },
  { id: 'web.search', name: 'Web Search', pattern: /\b(?:search|google|look up|find information)\b/, confidence: 0.76 },
  { id: 'file.management', name: 'File Management', pattern: /\b(?:file|folder|directory|move|delete|copy|rename)\b/, confidence: 0.72 },
  { id: 'reminder.management', name: 'Reminder Management', pattern: /\b(?:remind|reminder|notify|alert)\b/, inference: 'reminder-scheduling', confidence: 0.78 },
  { id: 'alarm.management', name: 'Alarm Management', pattern: /\b(?:alarm|wake me)\b/, inference: 'alarm-scheduling', confidence: 0.78 },
  { id: 'timer.management', name: 'Timer Management', pattern: /\b(?:timer|countdown|pomodoro)\b/, inference: 'timer-scheduling', confidence: 0.78 },
  { id: 'audio.adjustment', name: 'Audio Adjustment', pattern: /\b(?:volume|vol|mute|loud|quiet|sound|set it to)\b/, inference: 'audio-adjustment', confidence: 0.72 },
  { id: 'display.adjustment', name: 'Display Adjustment', pattern: /\b(?:brightness|screen|display|dim|brighter)\b/, confidence: 0.72 }
]);

class GoalReasoner extends BaseReasoner {
  reason(context) {
    const inferences = new Set(context.inferences.map(item => item.inference));
    for (const rule of GOAL_RULES) {
      const matched = rule.pattern.test(context.normalizedInput) || (rule.inference && inferences.has(rule.inference));
      if (!matched) continue;
      const entityBoost = this._entityBoost(context, rule.id);
      context.addUnique('candidateGoals', {
        id: rule.id,
        name: rule.name,
        confidence: Math.min(1, Number((rule.confidence + entityBoost).toFixed(3))),
        evidence: [rule.inference || 'input-pattern'],
        source: this.id
      });
      context.addEvidence('goal', rule.id, rule.confidence, this.id);
    }
    context.diagnostics.goalCandidates = context.candidateGoals.length;
    return context;
  }

  _entityBoost(context, goalId) {
    if (goalId === 'media.playback' && context.entitySummary.media) return context.configuration?.entityBoost || 0.08;
    if ((goalId === 'reminder.management' && context.entitySummary.reminders) ||
      (goalId === 'alarm.management' && context.entitySummary.alarms) ||
      (goalId === 'timer.management' && context.entitySummary.timers)) return context.configuration?.entityBoost || 0.08;
    if (goalId === 'file.management' && (context.entitySummary.files || context.entitySummary.folders || context.entitySummary.paths)) return context.configuration?.entityBoost || 0.08;
    if (goalId === 'audio.adjustment' && context.entitySummary.volumeLevels) return context.configuration?.entityBoost || 0.08;
    if (goalId === 'display.adjustment' && context.entitySummary.brightnessLevels) return context.configuration?.entityBoost || 0.08;
    return 0;
  }
}

const GOAL_TO_INTENTS = Object.freeze({
  'media.playback': ['PlayMedia', 'OpenMediaPlatform'],
  'send.document': ['SendDocument', 'ShareFile'],
  'device.transfer': ['TransferFile', 'ShareFile'],
  productivity: ['OpenApplication', 'OpenFolder'],
  'application.control': ['OpenApplication', 'CloseApplication', 'SwitchApplication'],
  'web.search': ['SearchWeb', 'OpenWebsite'],
  'file.management': ['OpenFile', 'MoveFile', 'DeleteFile', 'OpenFolder'],
  'reminder.management': ['CreateReminder', 'ShowReminders', 'CancelReminder'],
  'alarm.management': ['SetAlarm', 'ShowAlarms', 'CancelAlarm'],
  'timer.management': ['SetTimer', 'ShowTimers', 'CancelTimer'],
  'audio.adjustment': ['SetVolume', 'MuteAudio'],
  'display.adjustment': ['SetBrightness']
});

class IntentReasoner extends BaseReasoner {
  reason(context) {
    for (const goal of context.candidateGoals) {
      const intents = GOAL_TO_INTENTS[goal.id] || [];
      for (const intent of intents) {
        context.addUnique('candidateIntents', {
          intent,
          confidence: Number((goal.confidence * this._intentWeight(intent, context)).toFixed(3)),
          evidence: [goal.id],
          source: this.id
        });
      }
    }
    context.diagnostics.intentCandidates = context.candidateIntents.length;
    return context;
  }

  _intentWeight(intent, context) {
    if (/^(SetAlarm|SetTimer|CreateReminder)$/.test(intent) && (context.entitySummary.times || context.entitySummary.durations || context.entitySummary.dates)) return 0.94;
    if (intent === 'PlayMedia' && context.entitySummary.media) return 0.94;
    if (intent === 'SetVolume' && context.entitySummary.volumeLevels) return 0.95;
    if (intent === 'SetBrightness' && context.entitySummary.brightnessLevels) return 0.95;
    return 0.9;
  }
}

const ACTION_RULES = Object.freeze([
  { action: 'OPEN_APPLICATION', pattern: /\b(open|launch|start|run)\b/, intent: 'OpenApplication', confidence: 0.84 },
  { action: 'CLOSE_APPLICATION', pattern: /\b(close|quit|exit|stop)\b/, intent: 'CloseApplication', confidence: 0.84 },
  { action: 'SEARCH_WEB', pattern: /\b(search|google|look up|what is|who is|how to)\b/, intent: 'SearchWeb', confidence: 0.82 },
  { action: 'PLAY_MEDIA', pattern: /\b(play|listen|watch|stream|music|song)\b/, intent: 'PlayMedia', confidence: 0.82 },
  { action: 'PAUSE_MEDIA', pattern: /\bpause\b/, intent: 'PauseMedia', confidence: 0.78 },
  { action: 'RESUME_MEDIA', pattern: /\bresume\b/, intent: 'ResumeMedia', confidence: 0.78 },
  { action: 'SET_VOLUME', pattern: /\b(volume|vol|sound|loud|quiet|set it to)\b/, intent: 'SetVolume', confidence: 0.8 },
  { action: 'MUTE_AUDIO', pattern: /\bmute\b/, intent: 'MuteAudio', confidence: 0.8 },
  { action: 'SET_BRIGHTNESS', pattern: /\b(brightness|screen|display|dim|brighter)\b/, intent: 'SetBrightness', confidence: 0.78 },
  { action: 'OPEN_FOLDER', pattern: /\b(open|show).*\b(folder|directory)\b/, intent: 'OpenFolder', confidence: 0.8 },
  { action: 'OPEN_FILE', pattern: /\b(open|show).*\b(file|document|pdf)\b/, intent: 'OpenFile', confidence: 0.78 },
  { action: 'DELETE_FILE', pattern: /\b(delete|remove|erase)\b/, intent: 'DeleteFile', confidence: 0.8 },
  { action: 'MOVE_FILE', pattern: /\b(move|copy)\b/, intent: 'MoveFile', confidence: 0.78 },
  { action: 'TRANSFER_FILE', pattern: /\b(send|share|transfer).*\b(phone|mobile|laptop|computer)\b/, intent: 'TransferFile', confidence: 0.8 },
  { action: 'CREATE_REMINDER', pattern: /\b(remind|reminder|notify|alert)\b/, intent: 'CreateReminder', confidence: 0.82 },
  { action: 'SET_ALARM', pattern: /\b(alarm|wake me)\b/, intent: 'SetAlarm', confidence: 0.82 },
  { action: 'SET_TIMER', pattern: /\b(timer|countdown|pomodoro)\b/, intent: 'SetTimer', confidence: 0.82 }
]);

class ActionReasoner extends BaseReasoner {
  reason(context) {
    const intents = new Set(context.candidateIntents.map(item => item.intent));
    for (const rule of ACTION_RULES) {
      const patternMatched = rule.pattern.test(context.normalizedInput);
      const correctionMatched = context.metadata.isCorrection === true && rule.action === 'SET_VOLUME' && intents.has(rule.intent);
      if (!patternMatched && !correctionMatched) continue;
      const metadata = this._metadataForAction(context, rule.action);
      context.addUnique('candidateActions', {
        action: rule.action,
        confidence: Math.min(1, Number((rule.confidence + (metadata.entityBacked ? (context.configuration?.entityBoost || 0.08) : 0)).toFixed(3))),
        evidence: [rule.intent],
        source: this.id,
        metadata
      });
      context.addEvidence('action', rule.action, rule.confidence, this.id);
    }
    context.diagnostics.actionCandidates = context.candidateActions.length;
    return context;
  }

  _metadataForAction(context, action) {
    const entities = {};
    const add = (name, value) => { if (value !== null && value !== undefined && value !== '') entities[name] = value; };
    add('mediaQuery', this.entityValue(context, 'media'));
    add('appName', this.entityValue(context, 'applications'));
    add('browserName', this.entityValue(context, 'browsers'));
    add('filename', this.entityValue(context, 'files'));
    add('folderName', this.entityValue(context, 'folders'));
    add('path', this.entityValue(context, 'paths'));
    add('contactName', this.entityValue(context, 'contacts'));
    add('reminderText', this.entityValue(context, 'reminders'));
    add('alarmLabel', this.entityValue(context, 'alarms'));
    add('timerLabel', this.entityValue(context, 'timers'));
    add('timeExpression', this.entityValue(context, 'times') || this.entityValue(context, 'dates'));
    add('duration', this.entityValue(context, 'durations'));
    add('value', this.entityValue(context, action === 'SET_BRIGHTNESS' ? 'brightnessLevels' : 'volumeLevels'));
    return {
      entities,
      entityBacked: Object.keys(entities).length > 0,
      actionFamily: String(action || '').split('_')[0].toLowerCase()
    };
  }
}

class TaskReasoner extends BaseReasoner {
  reason(context) {
    const actions = new Set(context.candidateActions.map(item => item.action));
    const entities = this._entities(context);
    if (actions.has('MOVE_FILE')) {
      context.addTask({ task: 'Identify source file', action: 'MOVE_FILE', confidence: 0.68, source: this.id, metadata: { entities } });
      context.addTask({ task: 'Identify destination', action: 'MOVE_FILE', confidence: 0.68, source: this.id, metadata: { entities } });
    }
    if (context.candidateGoals.some(goal => goal.id === 'send.document')) {
      context.addTask({ task: 'Locate document', action: 'OPEN_FILE', confidence: 0.7, source: this.id, metadata: { entities } });
      context.addTask({ task: 'Identify recipient', action: 'SEND_MESSAGE', confidence: 0.64, source: this.id, metadata: { entities } });
      context.addTask({ task: 'Attach document', action: 'TRANSFER_FILE', confidence: 0.62, source: this.id, metadata: { entities } });
      context.addTask({ task: 'Send message', action: 'SEND_MESSAGE', confidence: 0.62, source: this.id, metadata: { entities } });
    }
    if (context.candidateGoals.some(goal => goal.id === 'productivity')) {
      context.addTask({ task: 'Identify work target', confidence: 0.6, source: this.id, metadata: { entities } });
      context.addTask({ task: 'Identify supporting application', action: 'OPEN_APPLICATION', confidence: 0.58, source: this.id, metadata: { entities } });
    }
    if (actions.has('PLAY_MEDIA')) context.addTask({ task: 'Play requested media', action: 'PLAY_MEDIA', confidence: 0.78, source: this.id, metadata: { entities } });
    if (actions.has('SEARCH_WEB')) context.addTask({ task: 'Search the web', action: 'SEARCH_WEB', confidence: 0.76, source: this.id, metadata: { entities } });
    if (actions.has('CREATE_REMINDER')) context.addTask({ task: 'Create reminder', action: 'CREATE_REMINDER', confidence: 0.78, source: this.id, metadata: { entities } });
    if (actions.has('SET_ALARM')) context.addTask({ task: 'Set alarm', action: 'SET_ALARM', confidence: 0.78, source: this.id, metadata: { entities } });
    if (actions.has('SET_TIMER')) context.addTask({ task: 'Set timer', action: 'SET_TIMER', confidence: 0.78, source: this.id, metadata: { entities } });
    if (actions.has('SET_VOLUME')) context.addTask({ task: 'Set volume', action: 'SET_VOLUME', confidence: 0.76, source: this.id, metadata: { entities } });
    if (actions.has('SET_BRIGHTNESS')) context.addTask({ task: 'Set brightness', action: 'SET_BRIGHTNESS', confidence: 0.76, source: this.id, metadata: { entities } });
    context.diagnostics.taskCandidates = context.candidateTasks.length;
    return context;
  }

  _entities(context) {
    const action = context.ranked('candidateActions')[0];
    return { ...(action?.metadata?.entities || {}) };
  }
}

class ContextReasoner extends BaseReasoner {
  reason(context) {
    const resolved = context.resolvedContext || {};
    if (resolved.application?.focusedApplication) {
      context.addEvidence('context.application', resolved.application.focusedApplication, 0.62, this.id);
    }
    if (resolved.browserState?.currentBrowser) {
      context.addEvidence('context.browser', resolved.browserState.currentBrowser, 0.62, this.id);
    }
    if (resolved.selections?.selectedText || resolved.selections?.selectedFiles?.length) {
      context.addEvidence('context.selection', 'selection-present', 0.66, this.id);
    }
    for (const reference of resolved.resolvedReferences || []) {
      context.addEvidence('context.reference', reference.target, reference.confidence || 0.6, this.id);
    }
    const recent = resolved.workingMemory?.lastAction || resolved.conversationMemory?.lastAction || resolved.metadata?.lastAction || null;
    if (recent) context.addEvidence('context.recent-action', String(recent), 0.66, this.id);
    if (/\b(?:it|that|them|this|same|again)\b/.test(context.normalizedInput)) {
      context.addEvidence('context.follow-up', 'reference-dependent-command', 0.68, this.id);
    }
    if (
      /\b(?:next|previous|prev|back|forward|pause|resume|play|stop)\b/.test(context.normalizedInput) &&
      (resolved.media?.active || resolved.application?.focusedApplication || resolved.browserState?.currentBrowser || recent)
    ) {
      context.addEvidence('context.active-surface', 'active-control-target', 0.7, this.id);
    }
    if (/\b(?:no no|actually|instead|set it to|change it to)\b/.test(context.normalizedInput)) {
      context.metadata.isCorrection = true;
      context.addEvidence('context.correction', 'correction-or-revision', 0.72, this.id);
      const value = context.entitySummary.volumeLevels || /\bvol(?:ume)?\b/.test(context.normalizedInput);
      if (value) {
        context.addUnique('candidateGoals', { id: 'audio.adjustment', name: 'Audio Adjustment', confidence: 0.78, evidence: ['context.correction'], source: this.id });
        context.addUnique('candidateIntents', { intent: 'SetVolume', confidence: 0.76, evidence: ['audio.adjustment'], source: this.id });
        context.addUnique('candidateActions', { action: 'SET_VOLUME', confidence: 0.78, evidence: ['SetVolume'], source: this.id });
      }
    }
    return context;
  }
}

const ACTION_PROFILES = Object.freeze({
  OPEN_APPLICATION: {
    family: 'application',
    entities: ['applications', 'websites', 'browsers'],
    contexts: ['context.application', 'context.reference'],
    targetWords: /\b(?:app|application|program|chrome|youtube|settings|calendar|reminders?|powerpoint|ppt)\b/,
  },
  CLOSE_APPLICATION: {
    family: 'application',
    entities: ['applications', 'browsers', 'windows'],
    contexts: ['context.application', 'context.reference', 'context.recent-action'],
    targetWords: /\b(?:app|application|program|window|chrome|youtube|powerpoint|ppt|it|that|them)\b/
  },
  SEARCH_WEB: {
    family: 'knowledge',
    entities: ['websites'],
    contexts: ['context.browser'],
    targetWords: /\b(?:what|who|where|why|how|search|google|web|website|internet|information)\b/
  },
  PLAY_MEDIA: {
    family: 'media',
    entities: ['media', 'websites', 'volumeLevels'],
    contexts: ['context.application', 'context.browser', 'context.recent-action'],
    targetWords: /\b(?:play|song|music|video|youtube|spotify|track|playlist|watch)\b/
  },
  PAUSE_MEDIA: {
    family: 'media',
    entities: ['media'],
    contexts: ['context.application', 'context.recent-action'],
    targetWords: /\b(?:pause|hold|stop)\b/
  },
  RESUME_MEDIA: {
    family: 'media',
    entities: ['media'],
    contexts: ['context.application', 'context.recent-action'],
    targetWords: /\b(?:resume|continue|play)\b/
  },
  SET_VOLUME: {
    family: 'audio',
    entities: ['volumeLevels'],
    contexts: ['context.recent-action'],
    targetWords: /\b(?:volume|vol|sound|audio|loud|quiet|mute)\b/
  },
  MUTE_AUDIO: {
    family: 'audio',
    entities: ['volumeLevels'],
    contexts: ['context.recent-action'],
    targetWords: /\b(?:mute|sound|audio)\b/
  },
  SET_BRIGHTNESS: {
    family: 'display',
    entities: ['brightnessLevels'],
    contexts: ['context.application'],
    targetWords: /\b(?:brightness|screen|display|dim|bright)\b/
  },
  OPEN_FOLDER: {
    family: 'file',
    entities: ['folders', 'paths'],
    contexts: ['context.selection', 'context.reference'],
    targetWords: /\b(?:folder|directory|downloads|documents|desktop|pictures)\b/
  },
  OPEN_FILE: {
    family: 'file',
    entities: ['files', 'paths'],
    contexts: ['context.selection', 'context.reference'],
    targetWords: /\b(?:file|document|pdf|ppt|pptx|doc|docx|sheet|report)\b/
  },
  DELETE_FILE: {
    family: 'file',
    entities: ['files', 'paths'],
    contexts: ['context.selection', 'context.reference'],
    targetWords: /\b(?:delete|remove|erase|file|folder|it|that)\b/
  },
  MOVE_FILE: {
    family: 'file',
    entities: ['files', 'folders', 'paths'],
    contexts: ['context.selection', 'context.reference'],
    targetWords: /\b(?:move|copy|file|folder|to|into)\b/
  },
  TRANSFER_FILE: {
    family: 'transfer',
    entities: ['files', 'folders', 'paths', 'devices'],
    contexts: ['context.selection', 'context.reference'],
    targetWords: /\b(?:send|share|transfer|copy|phone|mobile|device)\b/
  },
  CREATE_REMINDER: {
    family: 'schedule',
    entities: ['reminders', 'times', 'dates', 'durations'],
    contexts: ['context.recent-action'],
    targetWords: /\b(?:remind|reminder|notify|alert|daily|every|tomorrow|today)\b/
  },
  SET_ALARM: {
    family: 'schedule',
    entities: ['alarms', 'times', 'dates'],
    contexts: ['context.recent-action'],
    targetWords: /\b(?:alarm|wake|am|pm|daily|every)\b/
  },
  SET_TIMER: {
    family: 'schedule',
    entities: ['timers', 'durations'],
    contexts: ['context.recent-action'],
    targetWords: /\b(?:timer|countdown|minute|minutes|second|seconds|hour|hours|pomodoro)\b/
  }
});

const ACTION_GOALS = Object.freeze({
  OPEN_APPLICATION: 'application.control',
  CLOSE_APPLICATION: 'application.control',
  SEARCH_WEB: 'web.search',
  PLAY_MEDIA: 'media.playback',
  PAUSE_MEDIA: 'media.playback',
  RESUME_MEDIA: 'media.playback',
  SET_VOLUME: 'audio.adjustment',
  MUTE_AUDIO: 'audio.adjustment',
  SET_BRIGHTNESS: 'display.adjustment',
  OPEN_FOLDER: 'file.management',
  OPEN_FILE: 'file.management',
  DELETE_FILE: 'file.management',
  MOVE_FILE: 'file.management',
  TRANSFER_FILE: 'device.transfer',
  CREATE_REMINDER: 'reminder.management',
  SET_ALARM: 'alarm.management',
  SET_TIMER: 'timer.management'
});

const INCOMPATIBLE_ACTIONS = Object.freeze([
  ['OPEN_APPLICATION', 'CLOSE_APPLICATION'],
  ['SEARCH_WEB', 'OPEN_FILE'],
  ['SEARCH_WEB', 'OPEN_FOLDER'],
  ['SET_TIMER', 'SET_ALARM'],
  ['SET_VOLUME', 'MUTE_AUDIO']
]);

class DeliberationReasoner extends BaseReasoner {
  reason(context) {
    const before = context.ranked('candidateActions').map(item => ({
      action: item.action,
      confidence: rounded(item.confidence || 0)
    }));
    const steps = this._decompose(context);
    const evaluations = [];

    for (const action of context.candidateActions) {
      const evaluation = this._evaluateAction(context, action, steps);
      action.confidence = rounded((action.confidence || 0) + evaluation.delta);
      action.evidence = Array.from(new Set([...(action.evidence || []), 'deliberation']));
      action.metadata = {
        ...(action.metadata || {}),
        deliberation: {
          scoreDelta: rounded(evaluation.delta),
          strengths: evaluation.strengths,
          penalties: evaluation.penalties
        },
        ...CognitiveReasoner.riskForAction(action.action, context.futureExtensions.cognitiveReasoning)
      };
      context.addEvidence('deliberation.action', action.action, action.confidence, this.id);
      evaluations.push({
        action: action.action,
        confidence: action.confidence,
        strengths: evaluation.strengths,
        penalties: evaluation.penalties
      });
    }

    this._rebalanceGoals(context);
    this._surfaceCloseAmbiguity(context);

    const after = context.ranked('candidateActions').map(item => ({
      action: item.action,
      confidence: rounded(item.confidence || 0)
    }));
    context.futureExtensions.deliberation = {
      strategy: 'deterministic-reason-act-entity-context-rerank',
      decomposition: steps,
      before,
      after,
      evaluations
    };
    context.diagnostics.deliberation = {
      actionEvaluations: evaluations.length,
      stepCount: steps.length
    };
    return context;
  }

  _decompose(context) {
    const text = this.text(context);
    if (!text) return [];
    const segments = text
      .split(/\b(?:then|and then|after that|also|plus)\b|[.;]/i)
      .map(segment => segment.trim())
      .filter(Boolean)
      .slice(0, 6);

    if (segments.length <= 1) {
      return [{
        index: 1,
        text,
        kind: this._stepKind(text),
        source: 'single-step'
      }];
    }

    return segments.map((segment, index) => ({
      index: index + 1,
      text: segment,
      kind: this._stepKind(segment),
      source: 'connector-decomposition'
    }));
  }

  _stepKind(text) {
    if (/\b(?:after|in)\s+\d+\s+(?:second|seconds|minute|minutes|hour|hours)\b/.test(text)) return 'deferred';
    if (/\b(?:open|close|play|pause|resume|set|send|find|search|remind|alarm|timer)\b/.test(text)) return 'action';
    if (/^(?:what|who|where|when|why|how)\b/.test(text)) return 'question';
    return 'context';
  }

  _evaluateAction(context, action, steps) {
    const profile = ACTION_PROFILES[action.action] || {};
    const strengths = [];
    const penalties = [];
    const signalBoost = Math.max(0, Math.min(0.25, Number(context.configuration?.deliberationBoost ?? 0.08)));
    const penaltyScale = Math.max(0, Math.min(0.25, Number(context.configuration?.ambiguityPenalty ?? 0.08)));
    const entityStepBoost = Math.min(0.06, signalBoost * 0.56);
    const contextStepBoost = Math.min(0.05, signalBoost * 0.56);
    const languageBoost = Math.min(0.04, signalBoost * 0.44);
    const goalBoost = Math.min(0.04, signalBoost * 0.44);
    const deferredBoost = Math.min(0.04, signalBoost * 0.44);
    const maxPositiveDelta = Math.max(0.12, Math.min(0.25, signalBoost * 2.75));
    let delta = 0;

    const supportedEntities = (profile.entities || []).filter(collection => Number(context.entitySummary?.[collection] || 0) > 0);
    if (supportedEntities.length > 0) {
      const boost = Math.min(signalBoost + 0.06, supportedEntities.length * entityStepBoost);
      delta += boost;
      strengths.push(`entity:${supportedEntities.join(',')}`);
    }

    const supportingContexts = context.evidence
      .filter(item => (profile.contexts || []).includes(item.type))
      .map(item => item.type);
    if (supportingContexts.length > 0) {
      delta += contextStepBoost;
      strengths.push(`context:${Array.from(new Set(supportingContexts)).join(',')}`);
    }

    if (profile.targetWords?.test?.(context.normalizedInput)) {
      delta += languageBoost;
      strengths.push('target-language');
    }

    if (this._goalSupportsAction(context, action.action)) {
      delta += goalBoost;
      strengths.push('goal-consistent');
    }

    const cognitiveBoost = this._cognitiveSupportForAction(context, action.action, signalBoost);
    if (cognitiveBoost > 0) {
      delta += cognitiveBoost;
      strengths.push('cognitive-consistent');
    }

    if (steps.some(step => step.kind === 'deferred') && ['CREATE_REMINDER', 'SET_ALARM', 'SET_TIMER'].includes(action.action)) {
      delta += deferredBoost;
      strengths.push('deferred-step');
    }

    const penalty = this._ambiguityPenalty(context, action.action) * (penaltyScale > 0 ? penaltyScale / 0.08 : 0);
    if (penalty > 0) {
      delta -= penalty;
      penalties.push(`ambiguity:${penalty.toFixed(2)}`);
    }

    return {
      delta: Math.max(-0.18, Math.min(maxPositiveDelta, delta)),
      strengths,
      penalties
    };
  }

  _goalSupportsAction(context, action) {
    const goalId = ACTION_GOALS[action];
    if (!goalId) return false;
    return context.candidateGoals.some(goal => goal.id === goalId);
  }

  _cognitiveSupportForAction(context, action, signalBoost) {
    const dimensions = new Set((context.futureExtensions.cognitiveReasoning?.dimensions || []).map(item => item.id));
    const hasAny = (...ids) => ids.some(id => dimensions.has(id));
    const boost = Math.min(0.035, signalBoost * 0.4);
    if (['CREATE_REMINDER', 'SET_ALARM', 'SET_TIMER'].includes(action) && hasAny('temporal', 'planning')) return boost;
    if (['OPEN_APPLICATION', 'CLOSE_APPLICATION', 'PAUSE_MEDIA', 'RESUME_MEDIA'].includes(action) && hasAny('context', 'conversation')) return boost;
    if (action === 'PLAY_MEDIA' && hasAny('preference', 'knowledge', 'personalMemory')) return boost;
    if (['OPEN_FILE', 'OPEN_FOLDER', 'MOVE_FILE', 'DELETE_FILE'].includes(action) && hasAny('knowledge', 'spatial', 'privacy')) return boost;
    if (action === 'TRANSFER_FILE' && hasAny('identity', 'privacy', 'spatial')) return boost;
    if (action === 'SEARCH_WEB' && hasAny('knowledge', 'decision', 'causal')) return boost;
    if (['SET_VOLUME', 'MUTE_AUDIO', 'SET_BRIGHTNESS'].includes(action) && hasAny('causal', 'commonSense', 'context')) return boost;
    return 0;
  }

  _ambiguityPenalty(context, action) {
    const text = context.normalizedInput;
    if (action === 'SEARCH_WEB' && /\b(?:file|folder|directory|local|desktop|downloads|documents|pictures|reminders?|alarms?|timers?)\b/.test(text)) {
      return 0.09;
    }
    if (action === 'OPEN_APPLICATION' && /^(?:what|who|where|when|why|how)\b/.test(text)) {
      return 0.08;
    }
    if (action === 'SET_TIMER' && /\b(?:am|pm|alarm|wake)\b/.test(text) && !/\b(?:timer|countdown)\b/.test(text)) {
      return 0.1;
    }
    if (action === 'SET_ALARM' && /\b(?:for|in)\s+\d+\s+(?:second|seconds|minute|minutes|hour|hours)\b/.test(text) && /\b(?:timer|countdown)\b/.test(text)) {
      return 0.08;
    }
    if (action === 'DELETE_FILE' && !/\b(?:delete|remove|erase)\b/.test(text)) {
      return 0.08;
    }
    return 0;
  }

  _rebalanceGoals(context) {
    const topAction = context.ranked('candidateActions')[0];
    if (!topAction) return;
    const supportingGoal = ACTION_GOALS[topAction.action];
    if (!supportingGoal) return;

    for (const goal of context.candidateGoals) {
      if (goal.id !== supportingGoal) continue;
      goal.confidence = rounded((goal.confidence || 0) + 0.04);
      goal.evidence = Array.from(new Set([...(goal.evidence || []), 'top-action-support']));
      goal.metadata = { ...(goal.metadata || {}), topAction: topAction.action };
    }
  }

  _surfaceCloseAmbiguity(context) {
    const ranked = context.ranked('candidateActions');
    if (ranked.length < 2) return;
    const [first, second] = ranked;
    const margin = Math.abs((first.confidence || 0) - (second.confidence || 0));
    const incompatible = INCOMPATIBLE_ACTIONS.some(pair => pair.includes(first.action) && pair.includes(second.action));
    if (!incompatible || margin > 0.035) return;
    context.addClarification({
      requirement: 'action-choice',
      field: 'action',
      confidence: rounded(0.62 + (0.035 - margin)),
      source: this.id,
      options: [first.action, second.action],
      reason: 'top actions are too close after deliberation'
    });
  }
}

const CONFLICTS = Object.freeze([
  ['OPEN_APPLICATION', 'CLOSE_APPLICATION'],
  ['DELETE_FILE', 'MOVE_FILE'],
  ['SET_VOLUME', 'MUTE_AUDIO']
]);

class ConflictResolver extends BaseReasoner {
  reason(context) {
    const actions = new Set(context.candidateActions.map(item => item.action));
    for (const [left, right] of CONFLICTS) {
      if (actions.has(left) && actions.has(right)) {
        context.addConflict({
          type: 'action-conflict',
          actions: [left, right],
          confidence: 0.8,
          source: this.id
        });
      }
    }
    if (/\b(open|launch)\b.*\b(close|quit|exit)\b|\b(close|quit|exit)\b.*\b(open|launch)\b/.test(context.normalizedInput)) {
      context.addConflict({
        type: 'text-conflict',
        actions: ['OPEN_APPLICATION', 'CLOSE_APPLICATION'],
        confidence: 0.72,
        source: this.id
      });
    }
    const openCloseSameTarget = context.candidateActions.some(action => action.action === 'OPEN_APPLICATION') &&
      context.candidateActions.some(action => action.action === 'CLOSE_APPLICATION') &&
      (context.entitySummary.applications || /\bchrome|edge|notepad|browser\b/.test(context.normalizedInput));
    if (openCloseSameTarget) {
      context.addConflict({
        type: 'target-action-conflict',
        actions: ['OPEN_APPLICATION', 'CLOSE_APPLICATION'],
        confidence: 0.78,
        source: this.id
      });
    }
    context.diagnostics.conflicts = context.detectedConflicts.length;
    return context;
  }
}

class ClarificationEngine extends BaseReasoner {
  reason(context) {
    const text = context.normalizedInput;
    const hasBrowser = Boolean(context.resolvedContext?.browserState?.currentBrowser || context.resolvedContext?.workingMemory?.currentBrowser);
    const hasFile = Boolean(context.resolvedContext?.workingMemory?.currentFile || context.evidence.some(item => item.type === 'context.selection'));
    if (/\bopen browser\b/.test(text) && !hasBrowser) {
      this._missing(context, 'browser', 'target-browser', 0.7);
    }
    if (/\bplay music\b/.test(text) && !/\b(?:spotify|youtube|apple music|song|track)\b/.test(text)) {
      this._missing(context, 'media-platform', 'target-media-platform', 0.64);
    }
    if (/\b(?:move|delete|send)\s+(?:it|that|file|report)\b/.test(text) && !hasFile) {
      this._missing(context, 'file', 'target-file', 0.72);
    }
    if (context.candidateActions.some(action => action.action === 'PLAY_MEDIA') && !context.entitySummary.media && !/\b(?:music|song|playlist)\b/.test(text)) {
      this._missing(context, 'media-query', 'target-media', 0.64);
    }
    if (context.candidateActions.some(action => action.action === 'CREATE_REMINDER') && !context.entitySummary.reminders) {
      this._missing(context, 'reminderText', 'reminder-content', 0.68);
    }
    if (context.candidateActions.some(action => action.action === 'SET_TIMER') && !context.entitySummary.durations) {
      this._missing(context, 'duration', 'timer-duration', 0.68);
    }
    if (context.candidateActions.some(action => action.action === 'SET_ALARM') && !context.entitySummary.times) {
      this._missing(context, 'timeExpression', 'alarm-time', 0.68);
    }
    context.diagnostics.clarifications = context.clarificationRequirements.length;
    return context;
  }

  _missing(context, field, requirement, confidence) {
    context.addMissing({ field, confidence, source: this.id });
    context.addClarification({ requirement, field, confidence, source: this.id });
  }
}

class ConfidenceManager extends BaseReasoner {
  reason(context) {
    const goal = average(context.candidateGoals.map(item => item.confidence));
    const intent = average(context.candidateIntents.map(item => item.confidence));
    const action = average(context.candidateActions.map(item => item.confidence));
    const task = average(context.candidateTasks.map(item => item.confidence));
    const clarification = context.clarificationRequirements.length ? 0.5 : 0.9;
    const conflictPenalty = context.detectedConflicts.length ? 0.2 : 0;
    const entitySupport = Object.keys(context.entitySummary || {}).length > 0 ? 0.06 : 0;
    const contextSupport = context.evidence.some(item => item.type.startsWith('context.')) ? 0.04 : 0;
    const cognitive = context.futureExtensions.cognitiveReasoning || {};
    const cognitiveSignalCount = Array.isArray(cognitive.dimensions) ? cognitive.dimensions.length : 0;
    const cognitiveSupport = cognitiveSignalCount > 0
      ? Math.min(context.configuration?.cognitiveSignalBoost || 0.05, cognitiveSignalCount * 0.006)
      : 0;
    const uncertaintyPenalty = (cognitive.uncertainty?.score || 0) * (cognitive.uncertainty?.requiresClarification ? 0.12 : 0.04);
    const safetyPenalty = (cognitive.safety?.score || 0) * 0.05;
    const privacyPenalty = (cognitive.privacy?.score || 0) * 0.03;
    const overall = Math.max(0, Math.min(1,
      average([goal, intent, action, task || goal, clarification]) +
      entitySupport +
      contextSupport +
      cognitiveSupport -
      conflictPenalty -
      uncertaintyPenalty -
      safetyPenalty -
      privacyPenalty
    ));
    context.confidenceScores = {
      goal,
      intent,
      action,
      task,
      clarification,
      entitySupport,
      contextSupport,
      cognitiveSupport: Number(cognitiveSupport.toFixed(3)),
      uncertaintyPenalty: Number(uncertaintyPenalty.toFixed(3)),
      safetyPenalty: Number(safetyPenalty.toFixed(3)),
      privacyPenalty: Number(privacyPenalty.toFixed(3)),
      overall: Number(overall.toFixed(3)),
      explanations: {
        overall: 'deterministic evidence average with entity, context, cognitive, uncertainty, safety, and privacy calibration'
      }
    };
    context.diagnostics.confidenceDistribution = [goal, intent, action, task, clarification, cognitiveSupport, context.confidenceScores.overall];
    return context;
  }
}

class ReasoningGraphBuilder extends BaseReasoner {
  reason(context) {
    const maxNodes = context.configuration?.graphMaxNodes || 220;
    const maxEdges = context.configuration?.graphMaxEdges || 360;
    const nodes = [];
    const edges = [];
    const nodeByKey = new Map();

    const addNode = (key, type, value, confidence = 0, metadata = {}) => {
      if (!key || nodeByKey.has(key)) return nodeByKey.get(key) || null;
      if (nodes.length >= maxNodes) return null;
      const node = {
        id: key,
        type,
        value: String(value || ''),
        confidence: rounded(confidence),
        metadata: cleanMetadata(metadata || {})
      };
      nodes.push(node);
      nodeByKey.set(key, node);
      return node;
    };

    const addEdge = (from, to, type, confidence = 0.6, metadata = {}) => {
      if (!from || !to || from === to || edges.length >= maxEdges) return null;
      if (!nodeByKey.has(from) || !nodeByKey.has(to)) return null;
      const key = `${from}->${to}:${type}`;
      if (edges.some(edge => edge.key === key)) return null;
      const edge = {
        key,
        from,
        to,
        type,
        confidence: rounded(confidence),
        metadata: cleanMetadata(metadata || {})
      };
      edges.push(edge);
      return edge;
    };

    const inputNode = addNode('input:command', 'input', context.normalizedInput || context.input, 1, {
      source: context.metadata?.source || context.resolvedContext?.metadata?.source || ''
    });

    const evidenceIds = this._addEvidenceNodes(context, addNode, addEdge, inputNode?.id);
    const cognitiveIds = this._addCognitiveNodes(context, addNode, addEdge, inputNode?.id, evidenceIds);
    const goalIds = this._addCandidateNodes(context, 'candidateGoals', 'goal', addNode);
    const intentIds = this._addCandidateNodes(context, 'candidateIntents', 'intent', addNode);
    const actionIds = this._addCandidateNodes(context, 'candidateActions', 'action', addNode);
    const taskIds = this._addCandidateNodes(context, 'candidateTasks', 'task', addNode);
    const conflictIds = this._addCandidateNodes(context, 'detectedConflicts', 'conflict', addNode);
    const clarificationIds = this._addCandidateNodes(context, 'clarificationRequirements', 'clarification', addNode);

    this._connectEvidenceToGoals(context, evidenceIds, goalIds, addEdge);
    this._connectGoalsToIntents(context, goalIds, intentIds, addEdge);
    this._connectIntentsToActions(context, intentIds, actionIds, addEdge);
    this._connectActionsToTasks(context, actionIds, taskIds, addEdge);
    this._connectCognitiveToActions(context, cognitiveIds, actionIds, addEdge);
    this._connectReviewNodes(context, cognitiveIds, actionIds, conflictIds, clarificationIds, addEdge);

    const graphStats = {
      nodes: nodes.length,
      edges: edges.length,
      bounded: nodes.length >= maxNodes || edges.length >= maxEdges,
      maxNodes,
      maxEdges,
      cognitiveNodes: Object.keys(cognitiveIds).length,
      evidenceNodes: Object.keys(evidenceIds).length,
      goalNodes: Object.keys(goalIds).length,
      intentNodes: Object.keys(intentIds).length,
      actionNodes: Object.keys(actionIds).length,
      taskNodes: Object.keys(taskIds).length
    };
    context.diagnostics.graphStats = graphStats;
    context.reasoningGraph = deepFreeze({
      nodes: nodes.map(({ id, type, value, confidence, metadata }) => ({ id, type, value, confidence, metadata })),
      edges: edges.map(({ from, to, type, confidence, metadata }) => ({ from, to, type, confidence, metadata })),
      confidence: context.confidenceScores.overall || 0,
      entitySummary: { ...(context.entitySummary || {}) },
      path: context.diagnostics.pipelineOrder.slice(),
      stats: graphStats,
      cognitiveSummary: this._cognitiveSummary(context)
    });
    return context;
  }

  _addEvidenceNodes(context, addNode, addEdge, inputNodeId) {
    const ids = {};
    sortByConfidence(context.evidence).forEach((item, index) => {
      const id = `evidence:${index + 1}`;
      addNode(id, 'evidence', item.value, item.confidence, {
        evidenceType: item.type,
        source: item.source,
        ...(item.metadata || {})
      });
      ids[`${item.type}:${item.value}`] = id;
      ids[item.type] = ids[item.type] || id;
      addEdge(inputNodeId, id, 'observes', item.confidence);
    });
    return ids;
  }

  _addCognitiveNodes(context, addNode, addEdge, inputNodeId, evidenceIds) {
    const cognitive = context.futureExtensions.cognitiveReasoning || {};
    const ids = {};
    for (const dimension of cognitive.dimensions || []) {
      const id = `cognitive:${dimension.id}`;
      addNode(id, 'cognitive-dimension', dimension.id, dimension.confidence, {
        name: dimension.name,
        evidence: dimension.evidence
      });
      ids[dimension.id] = id;
      addEdge(inputNodeId, id, 'interprets', dimension.confidence);
      for (const evidence of dimension.evidence || []) {
        const evidenceId = evidenceIds[`reasoning.${dimension.id}:${evidence}`] || evidenceIds[`reasoning.${dimension.id}`];
        addEdge(evidenceId, id, 'supports', dimension.confidence);
      }
    }

    for (const hiddenIntent of cognitive.hiddenIntents || []) {
      const id = `hidden-intent:${hiddenIntent.id}`;
      addNode(id, 'hidden-intent', hiddenIntent.id, hiddenIntent.confidence, {
        alternatives: hiddenIntent.alternatives
      });
      ids[hiddenIntent.id] = id;
      addEdge(inputNodeId, id, 'hypothesizes', hiddenIntent.confidence);
    }

    for (const key of ['uncertainty', 'safety', 'privacy', 'learning', 'selfReflection']) {
      const item = cognitive[key];
      if (!item) continue;
      const score = key === 'selfReflection' ? (item.required ? 0.72 : 0.2) : item.score;
      if (!score) continue;
      const id = `cognitive-score:${key}`;
      addNode(id, `cognitive-${key}`, key, score, item);
      ids[key] = id;
      addEdge(inputNodeId, id, key === 'selfReflection' ? 'reviews' : 'scores', score);
    }
    return ids;
  }

  _addCandidateNodes(context, listName, type, addNode) {
    const ids = {};
    sortByConfidence(context[listName] || []).forEach((item, index) => {
      const value = itemKey(item);
      const id = `${type}:${index + 1}`;
      addNode(id, type, value, item.confidence, {
        source: item.source,
        ...(type === 'goal' ? { name: item.name } : {}),
        ...(type === 'task' ? { action: item.action || null } : {}),
        ...(type === 'conflict' ? { actions: item.actions || [] } : {}),
        ...(type === 'clarification' ? { field: item.field || null, reason: item.reason || '' } : {}),
        ...(item.metadata || {})
      });
      ids[value] = id;
    });
    return ids;
  }

  _connectEvidenceToGoals(context, evidenceIds, goalIds, addEdge) {
    for (const goal of context.candidateGoals || []) {
      const goalId = goalIds[goal.id];
      for (const evidence of goal.evidence || []) {
        const evidenceId = evidenceIds[evidence] || Object.entries(evidenceIds).find(([key]) => key.endsWith(`:${evidence}`))?.[1];
        addEdge(evidenceId, goalId, 'supports-goal', goal.confidence);
      }
    }
  }

  _connectGoalsToIntents(context, goalIds, intentIds, addEdge) {
    for (const intent of context.candidateIntents || []) {
      const intentId = intentIds[intent.intent];
      for (const evidence of intent.evidence || []) {
        addEdge(goalIds[evidence], intentId, 'implies-intent', intent.confidence);
      }
    }
  }

  _connectIntentsToActions(context, intentIds, actionIds, addEdge) {
    for (const action of context.candidateActions || []) {
      const actionId = actionIds[action.action];
      for (const evidence of action.evidence || []) {
        addEdge(intentIds[evidence], actionId, 'suggests-action', action.confidence);
      }
    }
  }

  _connectActionsToTasks(context, actionIds, taskIds, addEdge) {
    for (const task of context.candidateTasks || []) {
      const taskId = taskIds[task.task];
      addEdge(actionIds[task.action], taskId, 'plans-task', task.confidence);
    }
  }

  _connectCognitiveToActions(context, cognitiveIds, actionIds, addEdge) {
    const cognitive = context.futureExtensions.cognitiveReasoning || {};
    const dimensions = new Set((cognitive.dimensions || []).map(item => item.id));
    for (const action of context.candidateActions || []) {
      const actionId = actionIds[action.action];
      if (!actionId) continue;
      const actionDimensions = this._dimensionsForAction(action.action, dimensions);
      for (const dimension of actionDimensions) {
        addEdge(cognitiveIds[dimension], actionId, 'cognitive-support', action.confidence);
      }
      if (action.metadata?.dangerous || action.metadata?.requiresConfirmation) addEdge(cognitiveIds.safety, actionId, 'requires-review', cognitive.safety?.score || 0.72);
      if (action.metadata?.privacySensitive) addEdge(cognitiveIds.privacy, actionId, 'privacy-review', cognitive.privacy?.score || 0.72);
      if (action.metadata?.uncertain) addEdge(cognitiveIds.uncertainty, actionId, 'clarify-before-action', cognitive.uncertainty?.score || 0.72);
    }
  }

  _connectReviewNodes(context, cognitiveIds, actionIds, conflictIds, clarificationIds, addEdge) {
    const topActionId = actionIds[context.ranked('candidateActions')[0]?.action];
    for (const conflictId of Object.values(conflictIds)) {
      addEdge(topActionId, conflictId, 'may-conflict', 0.72);
      addEdge(cognitiveIds.selfReflection, conflictId, 'reviewed-by', 0.66);
    }
    for (const clarificationId of Object.values(clarificationIds)) {
      addEdge(cognitiveIds.uncertainty, clarificationId, 'asks-clarification', 0.72);
      addEdge(topActionId, clarificationId, 'needs-information', 0.62);
    }
  }

  _dimensionsForAction(action, dimensions) {
    const has = (...ids) => ids.filter(id => dimensions.has(id));
    if (['CREATE_REMINDER', 'SET_ALARM', 'SET_TIMER'].includes(action)) return has('temporal', 'planning', 'preference');
    if (['OPEN_APPLICATION', 'CLOSE_APPLICATION', 'PAUSE_MEDIA', 'RESUME_MEDIA'].includes(action)) return has('context', 'conversation', 'commonSense');
    if (action === 'PLAY_MEDIA') return has('preference', 'personalMemory', 'knowledge', 'emotional');
    if (['OPEN_FILE', 'OPEN_FOLDER', 'MOVE_FILE', 'DELETE_FILE'].includes(action)) return has('knowledge', 'spatial', 'privacy', 'safety');
    if (action === 'TRANSFER_FILE') return has('identity', 'privacy', 'spatial', 'conversation');
    if (action === 'SEARCH_WEB') return has('knowledge', 'decision', 'causal', 'uncertainty');
    if (['SET_VOLUME', 'MUTE_AUDIO', 'SET_BRIGHTNESS'].includes(action)) return has('causal', 'commonSense', 'context');
    return [];
  }

  _cognitiveSummary(context) {
    const cognitive = context.futureExtensions.cognitiveReasoning || {};
    return {
      dimensions: (cognitive.dimensions || []).slice(0, 8).map(item => item.id),
      hiddenIntents: (cognitive.hiddenIntents || []).slice(0, 5).map(item => item.id),
      uncertainty: cognitive.uncertainty?.level || 'none',
      safety: cognitive.safety?.level || 'none',
      privacy: cognitive.privacy?.level || 'none',
      learning: cognitive.learning?.level || 'none'
    };
  }
}

class GoalIntentReasoningStage extends PipelineStage {
  constructor(options = {}) {
    super({
      id: options.id || 'assistant.goalIntent.reasoning',
      name: options.name || 'Assistant Goal and Intent Reasoning',
      order: Number.isFinite(options.order) ? options.order : -2,
      enabled: options.enabled !== false
    });
    this.manager = options.manager || createDefaultReasoningManager({
      configuration: options.configuration || {},
      logger: options.logger || null
    });
  }

  async execute(context) {
    if (!context.resolvedContext) {
      return StageResult.skipped(this.id, 'No ResolvedContext available.');
    }
    const reasoningResult = await this.manager.reason(context.resolvedContext, {
      metadata: {
        ...(context.metadata || {}),
        rawInput: context.rawInput,
        source: context.source,
        structuredEntities: context.structuredEntities || context.get?.('assistant.structuredEntities') || null
      }
    });
    context.reasoningResult = reasoningResult;
    context.set('assistant.reasoningResult', reasoningResult);
    return StageResult.ok(this.id, {
      goal: reasoningResult.resolvedGoal?.id || null,
      intent: reasoningResult.resolvedIntent?.intent || null,
      action: reasoningResult.resolvedAction?.action || null,
      ready: reasoningResult.ready,
      entitySummary: reasoningResult.entitySummary,
      cognitive: reasoningResult.cognitiveReasoning ? {
        dimensions: (reasoningResult.cognitiveReasoning.dimensions || []).slice(0, 6).map(item => item.id),
        uncertainty: reasoningResult.cognitiveReasoning.uncertainty?.level || 'none',
        safety: reasoningResult.cognitiveReasoning.safety?.level || 'none',
        privacy: reasoningResult.cognitiveReasoning.privacy?.level || 'none'
      } : null,
      confidence: reasoningResult.confidenceScores.overall || 0,
      version: reasoningResult.version
    });
  }

  async destroy() {
    if (typeof this.manager?.destroy === 'function') this.manager.destroy();
    return super.destroy();
  }
}

module.exports = {
  ReasoningConfiguration,
  ReasoningLogger,
  ReasoningResult,
  ReasoningContext,
  ReasoningRegistry,
  ReasoningPipeline,
  ReasoningManager,
  createDefaultReasoningManager,
  BaseReasoner,
  InferenceEngine,
  CognitiveReasoner,
  GoalReasoner,
  IntentReasoner,
  ActionReasoner,
  TaskReasoner,
  ContextReasoner,
  DeliberationReasoner,
  ConflictResolver,
  ClarificationEngine,
  ConfidenceManager,
  ReasoningGraphBuilder,
  GoalIntentReasoningStage,
  ReasoningError,
  InferenceError,
  GoalReasoningError,
  IntentReasoningError,
  ActionReasoningError,
  ConflictError,
  ClarificationError,
  ConfigurationError,
  PipelineError
};