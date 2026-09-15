'use strict';

// Merged: BaseSemanticAnalyzer, ConfidenceEngine, ConversationClassifier, HumanStateLanguage, MeaningResolver, RelationshipAnalyzer, SemanticConfiguration, SemanticContext, SemanticDiagnostics, SemanticDictionary, SemanticErrors, SemanticGraphBuilder, SemanticLogger, SemanticManager, SemanticNormalizer, SemanticPipeline, SemanticRegistry, SemanticRepresentation, SemanticRoleLabeler, SemanticUnderstandingStage, SimilarityEngine

const { deepFreeze } = require('../utils');

// --- BaseSemanticAnalyzer.js ---
class BaseSemanticAnalyzer {
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

  supports() {
    return this.enabled;
  }

  analyze(context) {
    return context;
  }

  validate(context) {
    return !!context;
  }

  cleanup() {
    return true;
  }

  destroy() {
    this.initialized = false;
    return true;
  }
}

// --- ConfidenceEngine.js ---
function average(values) {
  const safe = values.filter(value => Number.isFinite(value));
  return safe.length ? safe.reduce((sum, value) => sum + value, 0) / safe.length : 0;
}

class ConfidenceEngine extends BaseSemanticAnalyzer {
  analyze(context) {
    const conceptConfidence = average((context.concepts || []).map(item => item.confidence));
    const roleConfidence = average((context.semanticRoles || []).map(item => item.confidence));
    const relationshipConfidence = average((context.relationships || []).map(item => item.confidence));
    const similarityConfidence = average((context.similarityResults || []).map(item => item.similarity));
    const conversationConfidence = Number(context.conversationType?.confidence || 0);
    const overall = average([conceptConfidence, roleConfidence, relationshipConfidence, conversationConfidence].filter(value => value > 0));
    context.confidenceScores = {
      meaning: conceptConfidence,
      dictionary: conceptConfidence,
      roles: roleConfidence,
      relationships: relationshipConfidence,
      similarity: similarityConfidence,
      conversation: conversationConfidence,
      overall,
      explanations: {
        meaning: 'Average confidence of dictionary concept matches.',
        roles: 'Average confidence of role labels derived from grammar.',
        relationships: 'Average confidence of semantic and grammar relationships.',
        overall: 'Average of available semantic dimensions; no execution decision is made.'
      }
    };
    return context;
  }
}

// --- ConversationClassifier.js ---
const GREETINGS = new Set(['hi', 'hello', 'hey']);
const FEEDBACK = new Set(['good', 'bad', 'wrong', 'correct', 'thanks', 'thank']);
const CORRECTIONS = new Set(['actually', 'instead', 'correction']);

class ConversationClassifier extends BaseSemanticAnalyzer {
  analyze(context) {
    const tokens = (context.linguisticGraph?.tokens || []).map(token => token.lower);
    const hasQuestion = (context.linguisticGraph?.questions || []).length > 0;
    let type = 'conversation';
    let confidence = 0.55;
    if (tokens.some(token => GREETINGS.has(token))) {
      type = 'greeting';
      confidence = 0.82;
    } else if (tokens.some(token => CORRECTIONS.has(token))) {
      type = 'correction';
      confidence = 0.72;
    } else if (tokens.some(token => FEEDBACK.has(token))) {
      type = 'feedback';
      confidence = 0.68;
    } else if (hasQuestion) {
      type = 'question';
      confidence = 0.8;
    } else if ((context.concepts || []).length > 0) {
      type = 'command';
      confidence = 0.62;
    }
    context.conversationType = { type, confidence, source: 'semantic.conversationClassifier' };
    return context;
  }
}

// --- HumanStateLanguage.js ---
const HUMAN_STATE_REPAIRS = Object.freeze({
  anxity: 'anxiety',
  anxous: 'anxious',
  anxios: 'anxious',
  bord: 'bored',
  coldd: 'cold',
  confuzed: 'confused',
  confuseed: 'confused',
  depresed: 'depressed',
  dizzyy: 'dizzy',
  exhasted: 'exhausted',
  fealing: 'feeling',
  feelng: 'feeling',
  frustated: 'frustrated',
  hungery: 'hungry',
  lonley: 'lonely',
  nervious: 'nervous',
  panicing: 'panicking',
  scarred: 'scared',
  shivring: 'shivering',
  sleppy: 'sleepy',
  stressd: 'stressed',
  stresed: 'stressed',
  thursty: 'thirsty',
  tierd: 'tired',
  tird: 'tired',
  tryed: 'tired',
  unwel: 'unwell',
  woried: 'worried'
});

const STATE_GROUPS = Object.freeze([
  {
    kind: 'cold',
    label: 'cold',
    terms: ['cold', 'chilly', 'freezing', 'shivering', 'frozen']
  },
  {
    kind: 'hot',
    label: 'hot',
    terms: ['hot', 'overheated', 'sweaty', 'burning up', 'too warm']
  },
  {
    kind: 'tired',
    label: 'tired',
    terms: ['tired', 'sleepy', 'exhausted', 'drained', 'fatigued', 'weak', 'low energy', 'worn out']
  },
  {
    kind: 'stressed',
    label: 'stressed',
    terms: ['stressed', 'stress', 'anxious', 'anxiety', 'worried', 'overwhelmed', 'nervous', 'tense', 'panic', 'panicking']
  },
  {
    kind: 'sick',
    label: 'unwell',
    terms: ['sick', 'ill', 'unwell', 'fever', 'feverish', 'dizzy', 'nauseous', 'headache', 'pain', 'hurt', 'hurting']
  },
  {
    kind: 'hungry',
    label: 'hungry',
    terms: ['hungry', 'starving', 'empty stomach']
  },
  {
    kind: 'thirsty',
    label: 'thirsty',
    terms: ['thirsty', 'dehydrated', 'dry mouth']
  },
  {
    kind: 'emotional',
    label: 'upset',
    terms: ['sad', 'upset', 'angry', 'lonely', 'alone', 'afraid', 'scared', 'depressed', 'crying', 'frustrated', 'disappointed', 'hurt emotionally', 'bored', 'ashamed', 'guilty', 'irritated']
  },
  {
    kind: 'confused',
    label: 'confused',
    terms: ['confused', 'lost', 'unclear', 'not understanding', 'do not understand', "don't understand"]
  },
  {
    kind: 'positive',
    label: 'good',
    terms: ['happy', 'excited', 'proud', 'good', 'better', 'fine', 'great', 'relieved', 'motivated']
  }
]);

const HUMAN_STATE_START_PATTERN = /^(?:i\s+am|i'm|im|i\s+feel|i\s+am\s+feeling|i\s+was|i\s+got|i\s+have|feeling|feel|my\s+body\s+feels|my\s+head\s+feels|my\s+stomach\s+feels|too)\b/i;
const ACTION_WORD_PATTERN = /\b(?:open|close|set|turn|play|pause|stop|send|message|call|remind|alarm|timer|search|find|delete|move|copy|scan|start|create|show)\b/i;
const PROFESSION_WORD_PATTERN = /\b(?:student|engineer|developer|teacher|doctor|designer|manager|assistant|from|at|working\s+at|studying\s+at|software|college|school|company)\b/i;

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeHumanStateText(value) {
  let text = String(value || '')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\bi'?m\b/g, 'i am')
    .replace(/\bim\b/g, 'i am')
    .replace(/\bfealin\b/g, 'feeling')
    .replace(/\bfeeling\s+tried\b/g, 'feeling tired')
    .replace(/\bfeel\s+tried\b/g, 'feel tired')
    .replace(/\bi\s+am\s+tried\b/g, 'i am tired')
    .replace(/\bi\s+was\s+tried\b/g, 'i was tired')
    .replace(/\btoo\s+tried\b/g, 'too tired')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  Object.entries(HUMAN_STATE_REPAIRS).forEach(([from, to]) => {
    text = text.replace(new RegExp(`\\b${escapeRegExp(from)}\\b`, 'g'), to);
  });

  return text.replace(/\s+/g, ' ').trim();
}

function hasStateTerm(text, terms) {
  return terms.some(term => new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i').test(text));
}

function classifyHumanState(input, options = {}) {
  const normalized = normalizeHumanStateText(input);
  if (!normalized) return null;

  const requireStarter = options.requireStarter !== false;
  const starter = HUMAN_STATE_START_PATTERN.test(normalized);
  if (requireStarter && !starter) return null;

  if (options.ignoreActionCommands !== false && ACTION_WORD_PATTERN.test(normalized)) {
    return null;
  }

  for (const group of STATE_GROUPS) {
    if (!hasStateTerm(normalized, group.terms)) continue;
    return {
      kind: group.kind,
      label: group.label,
      normalized,
      confidence: starter ? 0.94 : 0.72,
      healthAdjacent: ['cold', 'hot', 'tired', 'sick', 'hungry', 'thirsty'].includes(group.kind),
      emotional: ['stressed', 'emotional', 'confused', 'positive'].includes(group.kind)
    };
  }

  return null;
}

function isTransientHumanState(value) {
  const normalized = normalizeHumanStateText(value);
  if (!normalized || PROFESSION_WORD_PATTERN.test(normalized)) return false;
  return Boolean(classifyHumanState(`i am ${normalized}`, {
    requireStarter: true,
    ignoreActionCommands: false
  }));
}

const HumanStateLanguage = {
  HUMAN_STATE_REPAIRS,
  STATE_GROUPS,
  classifyHumanState,
  isTransientHumanState,
  normalizeHumanStateText
};

// --- MeaningResolver.js ---
class MeaningResolver extends BaseSemanticAnalyzer {
  analyze(context) {
    const tokens = context.linguisticGraph?.tokens || [];
    tokens.forEach(token => {
      const match = context.dictionary.lookup(token.value)[0];
      if (!match) return;
      context.addConcept({
        concept: match.concept,
        source: 'meaning-resolver',
        tokenId: token.id,
        value: token.value,
        confidence: match.confidence,
        metadata: { dictionaryTerm: match.term, dictionarySource: match.source }
      });
    });
    return context;
  }
}

// --- RelationshipAnalyzer.js ---
const ACTION_CONCEPTS = new Set(['OPEN', 'START', 'CLOSE', 'DISABLE', 'ENABLE', 'REDUCE', 'INCREASE', 'SEND', 'FIND', 'CREATE', 'DELETE', 'MOVE', 'STORE']);

class RelationshipAnalyzer extends BaseSemanticAnalyzer {
  analyze(context) {
    const concepts = context.concepts || [];
    const actions = concepts.filter(concept => ACTION_CONCEPTS.has(concept.concept));
    const targets = concepts.filter(concept => !ACTION_CONCEPTS.has(concept.concept));
    const relationships = [];
    actions.forEach(action => {
      const target = targets.find(candidate => !action.tokenId || !candidate.tokenId || candidate.tokenId !== action.tokenId);
      if (target) {
        relationships.push({
          type: 'concept-target',
          from: action.id,
          to: target.id,
          sourceConcept: action.concept,
          targetConcept: target.concept,
          confidence: Math.min(action.confidence, target.confidence)
        });
      }
    });
    (context.linguisticGraph?.dependencies || []).forEach(edge => {
      relationships.push({
        type: `grammar-${edge.relation}`,
        from: edge.governor,
        to: edge.dependent,
        confidence: edge.confidence || 0.5
      });
    });
    context.relationships = relationships;
    return context;
  }
}

// --- SemanticConfiguration.js ---
const DEFAULT_CONFIGURATION = Object.freeze({
  enabled: true,
  version: '5.0.0',
  locale: 'en-US',
  strict: false,
  confidenceThreshold: 0.55,
  analyzers: {},
  dictionaries: {}
});

const DEFAULT_ANALYZER_OPTIONS = Object.freeze({
  enabled: true,
  priority: 100,
  strict: false,
  languages: ['*'],
  confidenceThreshold: 0.55
});

class SemanticConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || DEFAULT_CONFIGURATION.version);
    this.locale = String(input.locale || DEFAULT_CONFIGURATION.locale);
    this.strict = input.strict === true;
    this.confidenceThreshold = Math.max(0, Math.min(1, Number(input.confidenceThreshold ?? DEFAULT_CONFIGURATION.confidenceThreshold)));
    this.analyzers = { ...(input.analyzers || {}) };
    this.dictionaries = { ...(input.dictionaries || {}) };
    this.providers = { ...(input.providers || {}) };
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
}

// --- SemanticContext.js ---
class SemanticContext {
  constructor({ linguisticGraph = null, normalizedInput = null, configuration = {}, metadata = {} } = {}) {
    const config = configuration instanceof SemanticConfiguration
      ? configuration
      : new SemanticConfiguration(configuration);
    this.linguisticGraph = linguisticGraph || null;
    this.normalizedInput = normalizedInput || null;
    this.originalInput = normalizedInput?.originalInput || linguisticGraph?.originalInput || null;
    this.configuration = config;
    this.dictionary = new SemanticDictionary({ dictionaries: config.dictionaries });
    this.dictionaryLookups = [];
    this.concepts = [];
    this.semanticRoles = [];
    this.relationships = [];
    this.conversationType = null;
    this.similarityResults = [];
    this.confidenceScores = {};
    this.semanticGraph = null;
    this.diagnostics = [];
    this.warnings = [];
    this.metadata = { ...(metadata || {}) };
    this.futureExtensions = {};
    this.timing = {
      startedAt: Date.now(),
      finishedAt: null,
      durationMs: 0,
      analyzers: []
    };
  }

  addConcept(concept = {}) {
    const id = concept.id || `concept_${this.concepts.length}`;
    const entry = {
      id,
      concept: String(concept.concept || '').toUpperCase(),
      source: concept.source || null,
      tokenId: concept.tokenId || null,
      value: concept.value || '',
      confidence: Math.max(0, Math.min(1, Number(concept.confidence ?? 0.5))),
      metadata: { ...(concept.metadata || {}) }
    };
    if (entry.concept) this.concepts.push(entry);
    return entry;
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

  toRepresentation() {
    this.timing.finishedAt = Date.now();
    this.timing.durationMs = Math.max(0, this.timing.finishedAt - this.timing.startedAt);
    return new SemanticRepresentation({
      originalInput: this.originalInput,
      normalizedInput: this.normalizedInput,
      linguisticGraph: this.linguisticGraph,
      semanticGraph: this.semanticGraph,
      concepts: this.concepts,
      semanticRoles: this.semanticRoles,
      relationships: this.relationships,
      conversationType: this.conversationType,
      similarityResults: this.similarityResults,
      confidenceScores: this.confidenceScores,
      diagnostics: this.diagnostics.concat(this.warnings.map(warning => ({ level: 'warn', message: warning.message, data: warning.data, timestamp: warning.timestamp }))),
      metadata: this.metadata,
      timing: this.timing,
      version: this.configuration.version,
      futureExtensions: this.futureExtensions
    });
  }
}

// --- SemanticDiagnostics.js ---
class SemanticDiagnostics {
  constructor() {
    this.records = [];
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
}

// --- SemanticDictionary.js ---
const { ASSISTANT_TOKEN_CORRECTIONS, repairKnownTokenText } = require('../normalization/AssistantLexicon');

const DEFAULT_CONCEPTS = Object.freeze({
  OPEN: ['open', 'launch', 'fire up', 'start', 'bring up'],
  START: ['begin', 'start'],
  CLOSE: ['close', 'terminate', 'shut', 'exit', 'stop'],
  DISABLE: ['disable', 'switch off', 'turn off'],
  ENABLE: ['enable', 'switch on', 'turn on'],
  REDUCE: ['reduce', 'decrease', 'lower', 'down'],
  INCREASE: ['increase', 'raise', 'up'],
  SEND: ['send', 'share', 'transfer'],
  FIND: ['find', 'search', 'look for'],
  CREATE: ['create', 'make', 'new'],
  DELETE: ['delete', 'remove'],
  MOVE: ['move'],
  STORE: ['store', 'save'],
  MEDIA: ['music', 'song', 'video', 'movie', 'media'],
  APPLICATION: ['chrome', 'notepad', 'vscode', 'code', 'spotify', 'youtube', 'app', 'application'],
  FILE: ['file', 'document', 'docx', 'pdf', 'resume'],
  FOLDER: ['folder', 'directory'],
  EMAIL: ['email', 'mail'],
  TIMER: ['timer', 'alarm', 'reminder', 'stopwatch']
});

class SemanticDictionary extends BaseSemanticAnalyzer {
  constructor(options = {}) {
    super(options);
    this.concepts = this._buildConcepts(options.dictionaries || options.dictionary || {});
  }

  _buildConcepts(custom = {}) {
    const merged = { ...DEFAULT_CONCEPTS };
    const typoConcepts = {
      OPEN: ['opne', 'ope', 'lauch', 'lnauch'],
      CLOSE: ['cloe', 'clsoe', 'cancle'],
      FIND: ['seach', 'serch', 'saerch', 'photes', 'phots'],
      DELETE: ['dlete', 'delte'],
      TIMER: ['alram', 'alaram', 'remindee', 'remider', 'remeinder'],
      APPLICATION: ['crome', 'chrom', 'chrmoe', 'youtub', 'yotube', 'settngs'],
      MEDIA: ['musc', 'musci', 'sony'],
      SEND: ['transver', 'sende']
    };
    Object.entries(typoConcepts).forEach(([concept, values]) => {
      merged[concept] = Array.from(new Set([
        ...(merged[concept] || []),
        ...values,
        ...values.map(value => ASSISTANT_TOKEN_CORRECTIONS[value]).filter(Boolean)
      ]));
    });
    Object.entries(custom || {}).forEach(([concept, values]) => {
      merged[String(concept).toUpperCase()] = Array.from(new Set([
        ...(merged[String(concept).toUpperCase()] || []),
        ...(Array.isArray(values) ? values : [values]).filter(Boolean)
      ]));
    });
    return merged;
  }

  lookup(value) {
    const text = repairKnownTokenText(String(value || '').toLowerCase());
    const matches = [];
    Object.entries(this.concepts).forEach(([concept, terms]) => {
      terms.forEach(term => {
        const normalizedTerm = String(term).toLowerCase();
        if (text === normalizedTerm) {
          matches.push({ concept, term, confidence: 1, source: 'exact' });
        } else if (text.includes(normalizedTerm) || normalizedTerm.includes(text)) {
          matches.push({ concept, term, confidence: 0.72, source: 'partial' });
        }
      });
    });
    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  analyze(context) {
    context.dictionary = this;
    context.dictionaryLookups = (context.dictionaryLookups || []).concat(
      (context.linguisticGraph?.tokens || []).map(token => ({
        tokenId: token.id,
        value: token.value,
        matches: this.lookup(token.value).slice(0, 3)
      })).filter(item => item.matches.length > 0)
    );
    return context;
  }
}

// --- SemanticErrors.js ---
class SemanticError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = { ...(context || {}) };
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }
}

class DictionaryError extends SemanticError {}
class MeaningResolutionError extends SemanticError {}
class RelationshipError extends SemanticError {}
class SimilarityError extends SemanticError {}
class GraphBuilderError extends SemanticError {}
class ConfigurationError extends SemanticError {}
class AnalyzerExecutionError extends SemanticError {}

// --- SemanticGraphBuilder.js ---
class SemanticGraphBuilder extends BaseSemanticAnalyzer {
  analyze(context) {
    const nodes = [];
    (context.concepts || []).forEach(concept => {
      nodes.push({
        id: concept.id,
        type: 'concept',
        label: concept.concept,
        value: concept.value,
        confidence: concept.confidence
      });
    });
    (context.semanticRoles || []).forEach((role, index) => {
      nodes.push({
        id: `role_${index}`,
        type: 'role',
        label: role.role,
        value: role.value,
        confidence: role.confidence
      });
    });
    if (context.conversationType) {
      nodes.push({
        id: 'conversation_type',
        type: 'conversationType',
        label: context.conversationType.type,
        confidence: context.conversationType.confidence
      });
    }
    const edges = (context.relationships || []).map((relationship, index) => ({
      id: `edge_${index}`,
      type: relationship.type,
      from: relationship.from,
      to: relationship.to,
      confidence: relationship.confidence
    }));
    context.semanticGraph = deepFreeze({
      nodes,
      edges,
      size: { nodes: nodes.length, edges: edges.length },
      confidence: context.confidenceScores?.overall || 0,
      version: context.configuration.version
    });
    return context;
  }
}

// --- SemanticLogger.js ---
class SemanticLogger {
  constructor(logger = null) {
    this.logger = logger || null;
  }

  info(message, data = {}) {
    if (typeof this.logger?.info === 'function') this.logger.info(`[Semantic] ${message}`, data);
  }

  warn(message, data = {}) {
    if (typeof this.logger?.warn === 'function') this.logger.warn(`[Semantic] ${message}`, data);
  }

  error(message, data = {}) {
    if (typeof this.logger?.error === 'function') this.logger.error(`[Semantic] ${message}`, data);
  }
}

// --- SemanticManager.js ---
class SemanticManager {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof SemanticConfiguration
      ? options.configuration
      : new SemanticConfiguration(options.configuration || options);
    this.registry = options.registry || new SemanticRegistry();
    this.pipeline = options.pipeline || null;
    this.logger = options.logger || null;
    if (options.defaultAnalyzers !== false) this._registerDefaults();
  }

  _registerDefaults() {
    const defaults = [
      [MeaningResolver, 'semantic.meaningResolver', 10],
      [SemanticNormalizer, 'semantic.normalizer', 20],
      [SemanticDictionary, 'semantic.dictionary', 30],
      [SemanticRoleLabeler, 'semantic.roleLabeler', 40],
      [RelationshipAnalyzer, 'semantic.relationshipAnalyzer', 50],
      [ConversationClassifier, 'semantic.conversationClassifier', 60],
      [SimilarityEngine, 'semantic.similarityEngine', 70],
      [ConfidenceEngine, 'semantic.confidenceEngine', 80],
      [SemanticGraphBuilder, 'semantic.graphBuilder', 90]
    ];
    defaults.forEach(([Ctor, id, priority]) => {
      const configured = this.configuration.getAnalyzerOptions(id, { priority });
      this.registry.register(new Ctor({
        id,
        ...configured,
        dictionaries: this.configuration.dictionaries
      }), { id, priority: configured.priority });
    });
  }

  async analyze(linguisticGraph, normalizedInput = null, options = {}) {
    const context = new SemanticContext({
      linguisticGraph,
      normalizedInput,
      configuration: this.configuration,
      metadata: options.metadata || {}
    });
    if (!this.pipeline) {
      this.pipeline = new SemanticPipeline({
        registry: this.registry,
        configuration: this.configuration,
        logger: this.logger
      });
    }
    const semanticContext = await this.pipeline.run(context);
    return semanticContext.toRepresentation();
  }

  getStatus() {
    return {
      enabled: this.configuration.enabled,
      version: this.configuration.version,
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

function createDefaultSemanticManager(options = {}) {
  return new SemanticManager(options);
}

// --- SemanticNormalizer.js ---
class SemanticNormalizer extends BaseSemanticAnalyzer {
  analyze(context) {
    const seen = new Map();
    context.concepts = (context.concepts || []).filter(concept => {
      const key = `${concept.concept}:${concept.tokenId || concept.value}`;
      if (seen.has(key)) return false;
      seen.set(key, true);
      concept.normalizedConcept = String(concept.concept || '').toUpperCase();
      return true;
    });
    return context;
  }
}

// --- SemanticPipeline.js ---
class SemanticPipeline {
  constructor({ registry, configuration, diagnostics = null, logger = null } = {}) {
    this.registry = registry;
    this.configuration = configuration;
    this.diagnostics = diagnostics || new SemanticDiagnostics();
    this.logger = logger instanceof SemanticLogger ? logger : new SemanticLogger(logger);
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
        context.recordTiming(analyzer.id, Date.now() - startedAt, true);
      } catch (error) {
        const wrapped = error instanceof AnalyzerExecutionError
          ? error
          : new AnalyzerExecutionError(error.message || 'Semantic analyzer failed.', { analyzerId: analyzer.id, cause: error });
        context.recordTiming(analyzer.id, Date.now() - startedAt, false);
        context.addWarning('Semantic analyzer failed; continuing with current representation.', { analyzerId: analyzer.id });
        context.addDiagnostic({ level: 'warn', message: wrapped.message, analyzerId: analyzer.id });
        this.diagnostics.record({ level: 'warn', message: wrapped.message, analyzerId: analyzer.id });
        if (this.configuration.strict) throw wrapped;
      } finally {
        if (typeof analyzer.cleanup === 'function') await analyzer.cleanup(context);
      }
    }
    return context;
  }
}

// --- SemanticRegistry.js ---
class SemanticRegistry {
  constructor() {
    this.analyzers = new Map();
  }

  register(analyzer, options = {}) {
    if (!analyzer || typeof analyzer.analyze !== 'function') {
      throw new ConfigurationError('Semantic analyzer must provide analyze(context).');
    }
    const id = String(options.id || analyzer.id || analyzer.name || analyzer.constructor?.name || '').trim();
    if (!id) throw new ConfigurationError('Semantic analyzer id is required.');
    analyzer.id = id;
    if (Number.isFinite(options.priority)) analyzer.priority = Number(options.priority);
    if (options.enabled !== undefined) analyzer.enabled = options.enabled !== false;
    this.analyzers.set(id, analyzer);
    return this;
  }

  unregister(id) {
    return this.analyzers.delete(String(id || '').trim());
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

  clear() {
    const count = this.analyzers.size;
    this.analyzers.clear();
    return count;
  }
}

// --- SemanticRepresentation.js ---
class SemanticRepresentation {
  constructor({
    originalInput = null,
    normalizedInput = null,
    linguisticGraph = null,
    semanticGraph = null,
    concepts = [],
    semanticRoles = [],
    relationships = [],
    conversationType = null,
    similarityResults = [],
    confidenceScores = {},
    diagnostics = [],
    metadata = {},
    timing = {},
    version = '5.0.0',
    futureExtensions = {}
  } = {}) {
    this.originalInput = originalInput || null;
    this.normalizedInput = normalizedInput || null;
    this.linguisticGraph = linguisticGraph || null;
    this.semanticGraph = semanticGraph || null;
    this.concepts = Array.isArray(concepts) ? concepts.slice() : [];
    this.semanticRoles = Array.isArray(semanticRoles) ? semanticRoles.slice() : [];
    this.relationships = Array.isArray(relationships) ? relationships.slice() : [];
    this.conversationType = conversationType || null;
    this.similarityResults = Array.isArray(similarityResults) ? similarityResults.slice() : [];
    this.confidenceScores = { ...(confidenceScores || {}) };
    this.diagnostics = Array.isArray(diagnostics) ? diagnostics.slice() : [];
    this.metadata = { ...(metadata || {}) };
    this.timing = { ...(timing || {}) };
    this.version = String(version || '5.0.0');
    this.futureExtensions = { ...(futureExtensions || {}) };
    deepFreeze(this);
  }
}

// --- SemanticRoleLabeler.js ---
class SemanticRoleLabeler extends BaseSemanticAnalyzer {
  analyze(context) {
    const graph = context.linguisticGraph || {};
    const roles = [];
    (graph.subjects || []).forEach(subject => {
      roles.push({ role: 'Agent', tokenId: subject.tokenId, value: subject.value, source: 'subject', confidence: subject.confidence || 0.55 });
    });
    (graph.objects || []).forEach(object => {
      roles.push({ role: object.type === 'prepositional' ? 'Location' : 'Theme', tokenId: object.tokenId, value: object.value, source: object.type, confidence: object.confidence || 0.55 });
    });
    (graph.modifiers || []).forEach(modifier => {
      const role = modifier.type === 'adverb' ? 'Manner' : modifier.type === 'determiner' ? 'Quantity' : 'Theme';
      roles.push({ role, tokenId: modifier.tokenId, value: modifier.value, source: modifier.type, confidence: modifier.confidence || 0.5 });
    });
    (graph.tokens || []).filter(token => token.type === 'number').forEach(token => {
      roles.push({ role: 'Quantity', tokenId: token.id, value: token.value, source: 'number', confidence: 0.72 });
    });
    context.semanticRoles = roles;
    return context;
  }
}

// --- SemanticUnderstandingStage.js ---
const PipelineStage = require('../pipeline/PipelineStage');
const StageResult = require('../pipeline/StageResult');

class SemanticUnderstandingStage extends PipelineStage {
  constructor(options = {}) {
    super({
      id: options.id || 'assistant.semantic.understanding',
      name: options.name || 'Assistant Semantic Understanding',
      order: Number.isFinite(options.order) ? options.order : -25,
      enabled: options.enabled !== false
    });
    this.manager = options.manager || createDefaultSemanticManager({
      configuration: options.configuration || {},
      logger: options.logger || null
    });
  }

  async execute(context) {
    if (!context.linguisticGraph) {
      return StageResult.skipped(this.id, 'No LinguisticGraph available.');
    }
    const semanticRepresentation = await this.manager.analyze(
      context.linguisticGraph,
      context.normalizedInputObject,
      { metadata: context.metadata }
    );
    context.semanticRepresentation = semanticRepresentation;
    context.set('assistant.semanticRepresentation', semanticRepresentation);
    return StageResult.ok(this.id, {
      input: context.normalizedInput || context.rawInput,
      source: context.source,
      options: { ...(context.options || {}) },
      semanticRepresentation: {
        conceptCount: semanticRepresentation.concepts.length,
        relationshipCount: semanticRepresentation.relationships.length,
        conversationType: semanticRepresentation.conversationType?.type || null,
        confidence: semanticRepresentation.confidenceScores?.overall || 0,
        version: semanticRepresentation.version
      }
    });
  }

  async destroy() {
    if (typeof this.manager?.destroy === 'function') this.manager.destroy();
    return super.destroy();
  }
}

// --- SimilarityEngine.js ---
function jaccard(left = [], right = []) {
  const a = new Set(left);
  const b = new Set(right);
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = [...a].filter(item => b.has(item)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

class SimilarityEngine extends BaseSemanticAnalyzer {
  analyze(context) {
    const concepts = context.concepts || [];
    context.similarityResults = concepts.flatMap((left, leftIndex) => concepts.slice(leftIndex + 1).map(right => ({
      leftConceptId: left.id,
      rightConceptId: right.id,
      leftConcept: left.concept,
      rightConcept: right.concept,
      similarity: left.concept === right.concept ? 1 : jaccard(left.concept.split('_'), right.concept.split('_')),
      method: 'deterministic-concept-jaccard'
    })));
    return context;
  }
}

module.exports = {
  BaseSemanticAnalyzer,
  ConfidenceEngine,
  ConversationClassifier,
  HumanStateLanguage,
  MeaningResolver,
  RelationshipAnalyzer,
  SemanticConfiguration,
  SemanticContext,
  SemanticDiagnostics,
  SemanticDictionary,
  SemanticError,
  DictionaryError,
  MeaningResolutionError,
  RelationshipError,
  SimilarityError,
  GraphBuilderError,
  ConfigurationError,
  AnalyzerExecutionError,
  SemanticGraphBuilder,
  SemanticLogger,
  SemanticManager,
  SemanticNormalizer,
  SemanticPipeline,
  SemanticRegistry,
  SemanticRepresentation,
  SemanticRoleLabeler,
  SemanticUnderstandingStage,
  SimilarityEngine,
  createDefaultSemanticManager
};