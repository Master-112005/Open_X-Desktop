'use strict';

const { deepFreeze, sanitizeDetails, safeLogger } = require('../utils');

const MAX_DIAGNOSTIC_ITEMS = 100;
const DEFAULT_GENERATOR_OPTIONS = Object.freeze({ enabled: true, priority: 100 });

const RESPONSE_DIMENSIONS = Object.freeze([
  'directAnswer',
  'contextAware',
  'personalized',
  'conversational',
  'clarification',
  'confirmation',
  'proactive',
  'suggestion',
  'explanation',
  'stepByStep',
  'emotional',
  'shortMode',
  'detailedMode',
  'memoryBased',
  'adaptiveLength',
  'multiModal',
  'actionExplanation',
  'errorHandling',
  'safety',
  'confidence',
  'followUp',
  'personality',
  'privacyAware',
  'humanInitiative'
]);

const SENSITIVE_WORD_PATTERN = /\b(?:password|passcode|pin|otp|token|secret|private\s+key|api\s+key|credential)\b/i;
const UNCERTAIN_WORD_PATTERN = /\b(?:not fully sure|not fully certain|not certain|i think|need confirmation)\b/i;
const SENSITIVE_VALUE_PATTERN = /\b(password|passcode|pin|otp|token|secret|private key|api key|credential)\b\s*(?:is|=|:)\s*([^\s,.!?;]+)/gi;
const UNCERTAINTY_PATTERN = /\b(?:not fully certain|not fully sure|i think|may be|might be|please confirm)\b/i;

const FIELD_QUESTIONS = Object.freeze({
  reminderText: 'What should I remind you about?',
  message: 'What should I remind you about?',
  reminderMessage: 'What should I remind you about?',
  task: 'What should I remind you about?',
  title: 'What should I call it?',
  time: 'When should I do that?',
  timeExpression: 'When should I do that?',
  dueAt: 'When should I do that?',
  date: 'Which date should I use?',
  duration: 'How long should the timer run?',
  appName: 'Which app should I use?',
  targetApp: 'Which app should I use?',
  filename: 'Which file should I use?',
  fileName: 'Which file should I use?',
  fileType: 'What file type should I use?',
  filePath: 'Which file should I use?',
  path: 'Which file or folder should I use?',
  folderName: 'Which folder should I use?',
  folderPath: 'Which folder should I use?',
  contactName: 'Who should I contact?',
  recipient: 'Who should I send it to?',
  messageText: 'What message should I send?',
  email: 'Which email address should I use?',
  phoneNumber: 'Which phone number should I use?',
  query: 'What should I search for?'
});

function pushBounded(list, item) {
  list.push(item);
  if (list.length > MAX_DIAGNOSTIC_ITEMS) list.splice(0, list.length - MAX_DIAGNOSTIC_ITEMS);
}

function compactText(value, maxLength = 2000) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function cleanText(value, maxLength = 2200) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function stripTrailingPunctuation(value) {
  return String(value || '').replace(/[.!?]+$/g, '').trim();
}

function unique(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map(value => String(value || '').trim())
    .filter(Boolean)));
}

function naturalJoin(values) {
  const items = unique(values);
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function asNumber(value, fallback = null) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function compactSuggestions(suggestions) {
  return (Array.isArray(suggestions) ? suggestions : [])
    .slice(0, 8)
    .map(item => ({
      ...sanitizeDetails(item || {}),
      text: compactText(item?.text || item?.label || '', 220)
    }))
    .filter(item => item.text);
}

function dataFrom(result = {}) {
  return {
    ...(result?.entities || {}),
    ...(result?.data || {}),
    ...(result?.metadata || {}),
    ...(result?.futureExtensions || {})
  };
}

function getDecision(result = {}) {
  return result?.metadata?.decision ||
    result?.futureExtensions?.decision ||
    result?.decision ||
    null;
}

function normalizeActionName(value) {
  const action = String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!action) return 'that action';
  return action
    .split(' ')
    .map(part => part.length <= 2 && /^[A-Z0-9]+$/.test(part)
      ? part
      : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function extractMissingFields(result = {}, text = '') {
  const decision = getDecision(result);
  const requirements = Array.isArray(decision?.clarificationRequirements)
    ? decision.clarificationRequirements
    : [];
  const fromDecision = requirements.map(item => item?.field || item?.requirement || item?.reason);
  const validationMissing = Array.isArray(result?.validation?.missing) ? result.validation.missing : [];
  const languageMissing = Array.isArray(result?.languageUnderstanding?.missingEntities)
    ? result.languageUnderstanding.missingEntities
    : [];
  const fromText = [];
  const match = String(text || '').match(/one more detail before i can continue:\s*([^.,]+)/i);
  if (match?.[1]) {
    fromText.push(...match[1].split(/\s*,\s*/));
  }
  return unique([...fromDecision, ...validationMissing, ...languageMissing, ...fromText])
    .map(field => field.replace(/^entities\./, '').trim());
}

function missingFieldQuestion(fields, intentId = '') {
  const normalized = unique(fields)
    .map(field => field.replace(/^entities\./, '').trim())
    .filter(Boolean);
  if (normalized.length === 0) return 'What detail should I use?';

  if (normalized.length === 1) {
    const field = normalized[0];
    const lowerIntent = String(intentId || '').toLowerCase();
    if (lowerIntent === 'file.create') {
      if (field === 'filename' || field === 'fileName') return 'What should I name the file?';
      if (field === 'fileType') return 'What file type should it be?';
      if (field === 'path') return 'Where should I create the file?';
    }
    if (FIELD_QUESTIONS[field]) return FIELD_QUESTIONS[field];
    if (/reminder/.test(lowerIntent)) return 'What should I remind you about?';
    if (/alarm/.test(lowerIntent)) return 'What alarm time should I use?';
    if (/timer/.test(lowerIntent)) return 'How long should the timer run?';
    if (/message|chat/.test(lowerIntent)) return 'What message should I send?';
    if (/file/.test(lowerIntent)) return 'Which file should I use?';
    if (/folder/.test(lowerIntent)) return 'Which folder should I use?';
    return `What ${field} should I use?`;
  }

  const commonTime = normalized.some(field => /time|date|due|duration/i.test(field));
  const commonTarget = normalized.some(field => /app|file|folder|contact|recipient|target|query/i.test(field));
  if (commonTime && commonTarget) {
    return `I need the ${naturalJoin(normalized)} before I continue.`;
  }
  return `I need ${naturalJoin(normalized)} before I continue.`;
}

function confidenceValue(result = {}, fallback = 1) {
  const data = dataFrom(result);
  return Math.max(0, Math.min(1, asNumber(
    result.confidence ??
    result.intentConfidence ??
    data.confidence ??
    data.overallConfidence ??
    fallback,
    fallback
  )));
}

function classifyConfidence(confidence) {
  if (confidence >= 0.85) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}

function inferDetailMode({ text, result, source, responseStyle }) {
  const style = String(responseStyle || '').toLowerCase();
  if (['short', 'concise'].includes(style)) return 'short';
  if (['detailed', 'detail', 'verbose'].includes(style)) return 'detailed';
  if (result?.needsClarification || result?.requiresConfirmation) return 'short';
  if (String(result?.intent || '').startsWith('help') || /\b(?:explain|how|why|steps|setup)\b/i.test(text)) {
    return 'detailed';
  }
  return 'adaptive';
}

function inferTone(text = '') {
  const source = String(text || '').toLowerCase();
  if (/\b(?:sad|upset|lost|worried|scared|stressed|stressd|angry|depressed|tired|tried|tierd|sleepy|exhausted|hurt|cold|chilly|freezing|hot|sick|unwell|hungry|hungery|thirsty|thursty|anxious|anxous|overwhelmed|lonely|confused|confuzed|feeling|fealing)\b/.test(source)) {
    return 'supportive';
  }
  if (/\b(?:thanks|thank you|great|good|done|finished)\b/.test(source)) {
    return 'warm';
  }
  return 'professional';
}

function shouldExposeUncertainty(policy, text) {
  if (policy.responseKind === 'clarification') return false;
  if (policy.responseKind === 'confirmation') return false;
  if (policy.confidence.label !== 'low') return false;
  return !UNCERTAIN_WORD_PATTERN.test(text);
}

function appendSentence(text, sentence) {
  const base = cleanText(text);
  const addition = cleanText(sentence);
  if (!base) return addition;
  if (!addition) return base;
  if (base.toLowerCase().includes(addition.toLowerCase())) return base;
  return `${stripTrailingPunctuation(base)}. ${addition}`;
}

function directAnswerFrom(result = {}) {
  const data = dataFrom(result);
  const answer = data.answer || result.answer || null;
  if (answer?.text) return cleanText(answer.text);
  if (data.directAnswer) return cleanText(data.directAnswer);
  if (data.answerText) return cleanText(data.answerText);
  return '';
}

function recoverySuggestion(result = {}) {
  const failed = Array.isArray(result.failedActions) ? result.failedActions : [];
  const first = failed[0] || {};
  const reason = String(first.error || first.reason || result.error || '').toLowerCase();
  if (reason.includes('not found')) return 'Try a more specific name or location.';
  if (reason.includes('permission')) return 'Check the permission setting, then retry.';
  if (reason.includes('timeout')) return 'Retry once the app or server is responsive.';
  if (result.needsClarification) return 'Reply with the missing detail and I can continue.';
  return '';
}

function composeActionSummary(result = {}) {
  const successful = Array.isArray(result.successfulActions) ? result.successfulActions : [];
  if (successful.length === 0) return '';
  const names = successful
    .slice(0, 4)
    .map(item => item.label || item.message || item.action || item.route || item.intent || item.taskId)
    .filter(Boolean)
    .map(normalizeActionName);
  if (names.length === 0) {
    return `${successful.length} action${successful.length === 1 ? '' : 's'} completed.`;
  }
  const more = successful.length > names.length ? `, plus ${successful.length - names.length} more` : '';
  return `Completed ${naturalJoin(names)}${more}.`;
}

function composeFailure(result = {}, baseText = '') {
  const failed = Array.isArray(result.failedActions) ? result.failedActions : [];
  const first = failed[0] || {};
  const target = normalizeActionName(first.action || first.route || first.taskId || result.intent || 'that request');
  const reason = cleanText(first.error || first.reason || first.message || result.error || '');
  if (baseText && !/^failed:/i.test(baseText)) return baseText;
  return reason ? `I could not complete ${target} because ${reason}.` : `I could not complete ${target}.`;
}

function resultData(context) {
  const result = context.verificationResult || {};
  return {
    ...(result.entities || {}),
    ...(result.data || {}),
    ...(result.metadata || {}),
    ...(result.futureExtensions || {})
  };
}

function gate(name, passed, reason = '') {
  return { name, passed: Boolean(passed), reason: String(reason || '') };
}

function safeText(text) {
  return compact(text).replace(SENSITIVE_VALUE_PATTERN, (_, label) => `${label} is [redacted]`);
}

class ResponseGenerationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = details.context || null;
    this.diagnostics = details.diagnostics || [];
    this.code = details.code || this.constructor.name;
    if (details.cause) this.cause = details.cause;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      diagnostics: this.diagnostics,
      cause: this.cause ? { name: this.cause.name, message: this.cause.message, code: this.cause.code || null } : null
    };
  }
}

class FormattingError extends ResponseGenerationError {}
class ConfigurationError extends ResponseGenerationError {}
class PipelineError extends ResponseGenerationError {}

class ResponseConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || '11.0.0');
    this.strict = input.strict === true;
    this.chatVerbosity = String(input.chatVerbosity || 'concise');
    this.suggestions = input.suggestions !== false;
    this.responsePolicy = input.responsePolicy !== false;
    this.responseQuality = input.responseQuality !== false;
    this.confidenceDisclosureThreshold = Math.max(0, Math.min(1, Number(input.confidenceDisclosureThreshold ?? 0.6)));
    this.defaultDetailMode = String(input.defaultDetailMode || 'adaptive');
    this.proactiveSuggestions = input.proactiveSuggestions !== false;
    this.maxGeneratorMs = Math.max(1, Number(input.maxGeneratorMs || 75));
    this.personalityStyle = String(input.personalityStyle || input.tone || 'professional');
    this.preserveChatLineBreaks = input.preserveChatLineBreaks === true;
    this.maxChatLength = Number(input.maxChatLength || 2400);
    this.maxNotificationLength = Number(input.maxNotificationLength || 120);
    this.maxParts = Number(input.maxParts || 20);
    this.maxSuggestions = Number(input.maxSuggestions || 8);
    this.generators = { ...(input.generators || {}) };
  }

  getGeneratorOptions(id, defaults = {}) {
    return {
      ...DEFAULT_GENERATOR_OPTIONS,
      ...(defaults || {}),
      ...(this.generators[String(id || '')] || {})
    };
  }

  toJSON() {
    return {
      enabled: this.enabled,
      version: this.version,
      strict: this.strict,
      chatVerbosity: this.chatVerbosity,
      suggestions: this.suggestions,
      responsePolicy: this.responsePolicy,
      responseQuality: this.responseQuality,
      confidenceDisclosureThreshold: this.confidenceDisclosureThreshold,
      defaultDetailMode: this.defaultDetailMode,
      proactiveSuggestions: this.proactiveSuggestions,
      maxGeneratorMs: this.maxGeneratorMs,
      personalityStyle: this.personalityStyle,
      preserveChatLineBreaks: this.preserveChatLineBreaks,
      maxChatLength: this.maxChatLength,
      maxNotificationLength: this.maxNotificationLength,
      maxParts: this.maxParts,
      maxSuggestions: this.maxSuggestions
    };
  }
}

class ResponseDiagnostics {
  constructor() {
    this.responseGenerationTime = {};
    this.formatterExecution = [];
    this.warnings = [];
    this.errors = [];
    this.pipelineOrder = [];
    this.responsePolicy = null;
    this.responseQuality = null;
    this.memoryUsage = this._memoryUsage();
  }

  time(id, durationMs) { this.responseGenerationTime[String(id || '')] = Math.max(0, Number(durationMs) || 0); }
  formatter(id) { pushBounded(this.formatterExecution, { id: String(id || ''), timestamp: Date.now() }); }
  warn(message, data = {}) { pushBounded(this.warnings, { message: String(message || ''), data: sanitizeDetails(data), timestamp: Date.now() }); }
  policy(policy) { this.responsePolicy = sanitizeDetails(policy || null); }
  quality(quality) { this.responseQuality = sanitizeDetails(quality || null); }
  error(error, data = {}) {
    pushBounded(this.errors, {
      name: error?.name || 'Error',
      message: String(error?.message || error || ''),
      stack: error?.stack || '',
      code: error?.code || null,
      data: sanitizeDetails(data),
      timestamp: Date.now()
    });
  }

  summary() {
    const timings = Object.values(this.responseGenerationTime);
    const total = timings.reduce((sum, value) => sum + value, 0);
    return {
      generatorCount: Object.keys(this.responseGenerationTime).length,
      formatterCount: this.formatterExecution.length,
      warningCount: this.warnings.length,
      errorCount: this.errors.length,
      totalDurationMs: Math.round(total * 1000) / 1000
    };
  }

  _memoryUsage() {
    return typeof process !== 'undefined' && typeof process.memoryUsage === 'function'
      ? process.memoryUsage()
      : null;
  }

  toJSON() {
    return {
      responseGenerationTime: { ...this.responseGenerationTime },
      formatterExecution: this.formatterExecution.slice(),
      warnings: this.warnings.slice(),
      errors: this.errors.slice(),
      pipelineOrder: this.pipelineOrder.slice(),
      responsePolicy: sanitizeDetails(this.responsePolicy),
      responseQuality: sanitizeDetails(this.responseQuality),
      memoryUsage: this.memoryUsage,
      summary: this.summary()
    };
  }
}

class AssistantResponse {
  constructor(input = {}) {
    this.verificationResult = input.verificationResult || null;
    this.responseType = String(input.responseType || 'summary');
    this.formattedChatResponse = compactText(input.formattedChatResponse, 2400);
    this.formattedNotification = compactText(input.formattedNotification, 180);
    this.suggestions = compactSuggestions(input.suggestions);
    this.diagnostics = sanitizeDetails(input.diagnostics || {});
    this.metadata = sanitizeDetails(input.metadata || {});
    this.timing = { ...(input.timing || {}) };
    this.version = String(input.version || '11.0.0');
    this.futureExtensions = sanitizeDetails(input.futureExtensions || {});
    deepFreeze(this);
  }
}

class ResponseLogger {
  constructor(logger = null) {
    this.logger = safeLogger(logger);
  }

  safeData(data) { return sanitizeDetails(data || {}); }
  debug(message, data) { this.logger.debug(message, this.safeData(data)); }
  info(message, data) { this.logger.info(message, this.safeData(data)); }
  warn(message, data) { this.logger.warn(message, this.safeData(data)); }
  error(message, data) { this.logger.error(message, this.safeData(data)); }
}

class ResponseRegistry {
  constructor() {
    this.generators = new Map();
  }

  register(generator, options = {}) {
    if (!generator || typeof generator.generate !== 'function') {
      throw new ConfigurationError('Response generator must provide generate(context).');
    }
    const id = String(options.id || generator.id || generator.constructor?.name || '').trim();
    if (!id) throw new ConfigurationError('Response generator id is required.');
    generator.id = id;
    if (Number.isFinite(options.priority)) generator.priority = Number(options.priority);
    if (options.enabled !== undefined) generator.enabled = options.enabled !== false;
    if (this.generators.has(id) && options.replace !== true) {
      throw new ConfigurationError(`Response generator already registered: ${id}`);
    }
    this.generators.set(id, generator);
    return this;
  }

  get(id) { return this.generators.get(String(id || '').trim()) || null; }
  unregister(id) { return this.generators.delete(String(id || '').trim()); }
  count() { return this.generators.size; }

  list({ includeDisabled = true } = {}) {
    return [...this.generators.values()]
      .filter(generator => includeDisabled || generator.enabled !== false)
      .sort((left, right) => (Number(left.priority) || 0) - (Number(right.priority) || 0) || String(left.id).localeCompare(String(right.id)));
  }

  health() {
    return this.list().map(generator => ({
      id: generator.id,
      version: generator.version,
      priority: generator.priority,
      enabled: generator.enabled !== false,
      initialized: generator.initialized === true
    }));
  }

  clear() {
    const count = this.generators.size;
    this.generators.clear();
    return count;
  }
}

class BaseResponseGenerator {
  constructor(options = {}) {
    this.id = String(options.id || this.constructor.name);
    this.name = String(options.name || this.id);
    this.priority = Number.isFinite(options.priority) ? Number(options.priority) : 100;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.options = { ...(options || {}) };
    this.initialized = false;
  }

  initialize() { this.initialized = true; return true; }
  supports(context) { return this.enabled && !!context; }
  generate(context) { return context; }
  cleanup() { return true; }
  destroy() { this.initialized = false; return true; }

  text(value, maxLength = 500) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
  }

  ensureSentence(value, maxLength = 500) {
    const text = this.text(value, maxLength);
    if (!text) return '';
    return /[.!?]$/.test(text) ? text : `${text}.`;
  }

  sentences(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(/(?<=[.!?])\s+/)
      .map(sentence => sentence.trim())
      .filter(Boolean);
  }

  firstSentence(value, maxLength = 220) {
    const first = this.sentences(value)[0] || this.text(value, maxLength);
    return this.text(first, maxLength);
  }

  formatList(items, { maxItems = 5, empty = '' } = {}) {
    const values = (Array.isArray(items) ? items : [])
      .map(item => String(item || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (values.length === 0) return empty;
    const shown = values.slice(0, Math.max(1, maxItems));
    const extra = values.length - shown.length;
    if (shown.length === 1) return extra > 0 ? `${shown[0]}, plus ${extra} more` : shown[0];
    const joined = shown.length === 2
      ? `${shown[0]} and ${shown[1]}`
      : `${shown.slice(0, -1).join(', ')}, and ${shown[shown.length - 1]}`;
    return extra > 0 ? `${joined}, plus ${extra} more` : joined;
  }

  stripStatusPrefix(value) {
    return String(value || '')
      .replace(/^\s*Status:\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  cleanForChannel(value, { channel = 'chat', maxLength = 500 } = {}) {
    let text = this.stripStatusPrefix(value);
    if (channel === 'notification') {
      text = this.firstSentence(text, maxLength);
    }
    return this.text(text, maxLength);
  }

  addPart(context, type, text, data = {}) {
    if (!context || typeof context.addPart !== 'function') return null;
    return context.addPart(type, this.text(text), data);
  }
}

class ResponseContext {
  constructor({ verificationResult = null, configuration = null, metadata = {} } = {}) {
    this.verificationResult = verificationResult || null;
    this.configuration = configuration || null;
    this.metadata = { ...(metadata || {}) };
    this.responseType = 'summary';
    this.parts = [];
    this.suggestions = [];
    this.formattedChatResponse = '';
    this.formattedNotification = '';
    this.diagnostics = new ResponseDiagnostics();
    this.timing = { startedAt: Date.now(), finishedAt: null, durationMs: 0 };
    this.futureExtensions = {};
  }

  addPart(type, text, data = {}) {
    const part = {
      type: String(type || 'summary'),
      text: compactText(text, 1000),
      data: sanitizeDetails(data || {})
    };
    if (part.text) {
      this.parts.push(part);
      const maxParts = Number(this.configuration?.maxParts || 20);
      if (this.parts.length > maxParts) this.parts.splice(0, this.parts.length - maxParts);
    }
    return part;
  }

  addSuggestion(type, text, data = {}) {
    const suggestion = {
      type: String(type || 'suggestion'),
      text: compactText(text, 220),
      ...sanitizeDetails(data || {})
    };
    if (suggestion.text) {
      this.suggestions.push(suggestion);
      const maxSuggestions = Number(this.configuration?.maxSuggestions || 8);
      if (this.suggestions.length > maxSuggestions) this.suggestions.splice(0, this.suggestions.length - maxSuggestions);
    }
    return suggestion;
  }

  baseText() {
    return this.parts.map(part => part.text).filter(Boolean).join(' ');
  }

  currentText() {
    return this.futureExtensions.responseText ||
      this.futureExtensions.naturalLanguage ||
      this.baseText() ||
      '';
  }

  setResponseText(text, maxLength = 2400) {
    const value = compactText(text, maxLength);
    if (value) this.futureExtensions.responseText = value;
    return value;
  }

  intentId() {
    const result = this.verificationResult || {};
    return String(result.intent || result.route || result.action || result.metadata?.intent || '').trim();
  }

  resultData() {
    const result = this.verificationResult || {};
    return sanitizeDetails({
      ...(result.entities || {}),
      ...(result.data || {}),
      ...(result.metadata || {}),
      ...(result.futureExtensions || {})
    });
  }

  toAssistantResponse() {
    this.timing.finishedAt = this.timing.finishedAt || Date.now();
    this.timing.durationMs = Math.max(0, this.timing.finishedAt - this.timing.startedAt);
    return new AssistantResponse({
      verificationResult: this.verificationResult,
      responseType: this.responseType,
      formattedChatResponse: this.formattedChatResponse,
      formattedNotification: this.formattedNotification,
      suggestions: this.suggestions,
      diagnostics: this.diagnostics.toJSON(),
      metadata: sanitizeDetails(this.metadata),
      timing: this.timing,
      version: this.configuration?.version || '11.0.0',
      futureExtensions: sanitizeDetails(this.futureExtensions)
    });
  }
}

class ConfirmationResponse extends BaseResponseGenerator {
  generate(context) {
    const result = context.verificationResult || {};
    const successfulActions = Array.isArray(result.successfulActions) ? result.successfulActions : [];
    if (result.executionStatus === 'COMPLETED' && successfulActions.length > 0) {
      context.responseType = 'confirmation';
      this.addPart(
        context,
        'confirmation',
        `${successfulActions.length} action${successfulActions.length === 1 ? '' : 's'} completed successfully.`,
        { completed: successfulActions.length }
      );
    }
    return context;
  }
}

class SummaryResponse extends BaseResponseGenerator {
  generate(context) {
    const result = context.verificationResult || {};
    if (context.parts.length > 0) return context;
    const completed = result.successfulActions?.length || 0;
    const failed = result.failedActions?.length || 0;
    const skipped = result.skippedActions?.length || 0;
    context.responseType = 'summary';
    const status = result.executionStatus || 'UNKNOWN';
    let text = `Status: ${status}. Completed ${completed}, failed ${failed}, skipped ${skipped}.`;
    if (completed === 0 && failed === 0 && skipped === 0) {
      text = result.success === false ? 'I could not complete that request.' : 'Done.';
    } else if (failed === 0 && skipped === 0) {
      text = `Completed ${completed} action${completed === 1 ? '' : 's'}.`;
    } else if (failed > 0 && completed > 0) {
      text = `Completed ${completed} action${completed === 1 ? '' : 's'}, but ${failed} failed.`;
    }
    this.addPart(context, 'summary', text, {
      completed,
      failed,
      skipped
    });
    return context;
  }
}

class ErrorResponse extends BaseResponseGenerator {
  generate(context) {
    const result = context.verificationResult || {};
    const failedActions = Array.isArray(result.failedActions) ? result.failedActions : [];
    if (failedActions.length === 0) return context;
    context.responseType = 'error';
    const first = failedActions[0];
    const target = first.action || first.route || first.taskId || 'action';
    const reason = first.error || first.reason || first.message || '';
    const targetText = String(target || 'action').replace(/[._-]+/g, ' ').trim() || 'action';
    this.addPart(context, 'error', reason
      ? `I could not complete ${targetText} because ${reason}`
      : `I could not complete ${targetText}.`, { failed: failedActions.length });
    return context;
  }
}

class ClarificationResponse extends BaseResponseGenerator {
  generate(context) {
    const decision = context.verificationResult?.metadata?.decision || context.verificationResult?.futureExtensions?.decision || null;
    const requirements = Array.isArray(decision?.clarificationRequirements) ? decision.clarificationRequirements : [];
    if (requirements.length === 0) return context;
    context.responseType = 'clarification';
    const fields = requirements
      .map(item => item.field || item.requirement || item.reason)
      .filter(Boolean)
      .slice(0, 4);
    const question = missingFieldQuestion(fields, context.verificationResult?.intent || '');
    this.addPart(context, 'clarification', fields.length > 0
      ? question
      : 'I need one more detail before I can continue.');
    return context;
  }
}

class SuggestionResponse extends BaseResponseGenerator {
  generate(context) {
    if (context.configuration?.suggestions === false) return context;
    const failed = context.verificationResult?.failedActions || [];
    const policy = context.futureExtensions.responsePolicy || {};
    const recovery = policy.recovery?.suggestion;

    if (failed.length > 0) {
      context.addSuggestion('recovery', recovery || 'Check the target and try again.', { failed: failed.length });
    } else if (context.responseType === 'clarification' || policy.responseKind === 'clarification') {
      context.addSuggestion('clarification', 'Reply with the missing detail and I can continue.');
    } else if (policy.responseKind === 'confirmation') {
      context.addSuggestion('decision', 'Confirm to continue, or cancel to stop the action.');
    } else {
      const nextActions = context.resultData?.().suggestedNextActions || context.verificationResult?.suggestedNextActions || [];
      (Array.isArray(nextActions) ? nextActions : [])
        .slice(0, Number(context.configuration?.maxSuggestions || 8))
        .forEach(action => {
          const text = action?.text || action?.label || action;
          if (text) context.addSuggestion('nextAction', text, action);
        });
    }
    return context;
  }
}

class NaturalLanguageFormatter extends BaseResponseGenerator {
  generate(context) {
    const text = context.futureExtensions.responseText || context.baseText();
    context.futureExtensions.naturalLanguage = this.cleanForChannel(text || 'I do not have a response for that yet.', {
      channel: 'chat',
      maxLength: 2400
    });
    context.diagnostics.formatter(this.id);
    return context;
  }
}

class ChatFormatter extends BaseResponseGenerator {
  generate(context) {
    const text = context.futureExtensions.responseText ||
      context.futureExtensions.naturalLanguage ||
      context.baseText() ||
      'I do not have a response for that yet.';
    context.formattedChatResponse = this.cleanForChannel(text, {
      channel: 'chat',
      maxLength: context.configuration?.maxChatLength || 2400
    });
    context.diagnostics.formatter(this.id);
    return context;
  }
}

class NotificationFormatter extends BaseResponseGenerator {
  generate(context) {
    const text = context.futureExtensions.responseText ||
      context.futureExtensions.naturalLanguage ||
      context.baseText();
    const limit = Number(context.configuration?.maxNotificationLength || 120);
    context.formattedNotification = this.cleanForChannel(text, {
      channel: 'notification',
      maxLength: limit
    });
    context.diagnostics.formatter(this.id);
    return context;
  }
}

class ResponseStyleManager extends BaseResponseGenerator {
  supports(context) {
    return super.supports(context) && context.configuration?.responsePolicy !== false;
  }

  generate(context) {
    const baseText = cleanText(context.futureExtensions.responseText || context.baseText());
    const policy = ResponseStyleManager.buildPolicy({
      baseText,
      result: context.verificationResult || {},
      metadata: context.metadata || {},
      source: context.metadata?.source || context.verificationResult?.source || '',
      responseStyle: context.metadata?.responseStyle || ''
    });
    const responseText = ResponseStyleManager.composeResponse(baseText, context.verificationResult || {}, policy);
    context.futureExtensions.responsePolicy = policy;
    if (responseText && responseText !== baseText) {
      context.futureExtensions.responseText = responseText;
    }
    context.diagnostics.policy?.(policy);
    return context;
  }

  static dimensions() {
    return RESPONSE_DIMENSIONS.slice();
  }

  static missingFieldQuestion(fields, intentId = '') {
    return missingFieldQuestion(fields, intentId);
  }

  static buildPolicy({ baseText = '', result = {}, metadata = {}, source = '', responseStyle = '' } = {}) {
    const text = cleanText(baseText);
    const input = metadata.input || result.input || result.originalInput || '';
    const missingFields = extractMissingFields(result, text);
    const failedActions = Array.isArray(result.failedActions) ? result.failedActions : [];
    const successfulActions = Array.isArray(result.successfulActions) ? result.successfulActions : [];
    const directAnswer = directAnswerFrom(result);
    const confidence = confidenceValue(result, directAnswer ? 0.9 : 1);
    const data = dataFrom(result);
    const decision = getDecision(result);
    const risk = String(data.risk || data.safetyRisk || decision?.risk || '').toLowerCase();
    const privacySensitive = Boolean(data.privacySensitive || data.requiresPrivacy || SENSITIVE_WORD_PATTERN.test(`${input} ${text}`));
    const safetySensitive = Boolean(result.requiresConfirmation || data.requiresConfirmation || ['high', 'critical'].includes(risk));

    let responseKind = 'summary';
    if (result.needsClarification || missingFields.length > 0 || /^i need clarification/i.test(text)) {
      responseKind = 'clarification';
    } else if (result.requiresConfirmation || decision?.requiresConfirmation || /^please confirm/i.test(text)) {
      responseKind = 'confirmation';
    } else if (failedActions.length > 0 || result.success === false || result.executionStatus === 'FAILED') {
      responseKind = 'error';
    } else if (directAnswer) {
      responseKind = 'directAnswer';
    } else if (successfulActions.length > 0 || result.success === true || result.executionStatus === 'COMPLETED') {
      responseKind = 'actionReport';
    }

    const policy = {
      version: '1.0.0',
      responseKind,
      dimensions: RESPONSE_DIMENSIONS.slice(),
      detailMode: inferDetailMode({ text: `${input} ${text}`, result, source, responseStyle }),
      tone: inferTone(`${input} ${text}`),
      confidence: {
        value: confidence,
        label: classifyConfidence(confidence),
        expose: confidence < 0.6
      },
      directAnswer: Boolean(directAnswer),
      contextAware: Boolean(result.context || metadata.context || result.resolvedContext),
      personalized: Boolean(data.preference || data.personalized || data.memory || data.userPreference),
      memoryBased: Boolean(data.memory || data.remembered || data.preference),
      clarification: responseKind === 'clarification' ? { missingFields } : null,
      confirmation: responseKind === 'confirmation' ? { risk: risk || 'medium' } : null,
      safety: {
        sensitive: safetySensitive,
        risk: risk || (safetySensitive ? 'medium' : 'low')
      },
      privacy: {
        sensitive: privacySensitive,
        boundary: privacySensitive ? 'Do not expose sensitive values in the response.' : ''
      },
      recovery: {
        suggestion: recoverySuggestion(result)
      },
      modality: {
        source: source || 'chat',
        notificationReady: true
      }
    };

    return policy;
  }

  static composeResponse(baseText = '', result = {}, policy = {}) {
    let text = cleanText(baseText);
    const direct = directAnswerFrom(result);

    if (policy.responseKind === 'directAnswer' && direct) {
      text = direct;
    } else if (policy.responseKind === 'clarification') {
      text = missingFieldQuestion(policy.clarification?.missingFields || [], result.intent);
    } else if (policy.responseKind === 'confirmation') {
      if (/^(?:status:\s*)?(?:pending|pending_confirmation|unknown)\b/i.test(text)) {
        text = 'Please confirm before I continue.';
      }
      if (!/\b(?:say yes|confirm|continue|cancel)\b/i.test(text)) {
        text = appendSentence(text || 'Please confirm before I continue.', 'Say yes to continue or no to cancel.');
      }
    } else if (policy.responseKind === 'error') {
      text = composeFailure(result, text);
      if (policy.recovery?.suggestion && !/would you like|try|retry|check/i.test(text)) {
        text = appendSentence(text, policy.recovery.suggestion);
      }
    } else if (policy.responseKind === 'actionReport') {
      const generic = /^(?:status:\s*)?(?:completed|unknown|failed|skipped|\d+\s+actions?\s+completed)/i.test(text);
      const actionSummary = composeActionSummary(result);
      if (generic && actionSummary) {
        text = actionSummary;
      }
    }

    if (policy.privacy?.sensitive && !/\b(?:sensitive|private|privacy|password|pin|otp)\b/i.test(text)) {
      text = appendSentence(text, 'I did not include sensitive details here.');
    }

    if (shouldExposeUncertainty(policy, text)) {
      text = appendSentence(text, 'I am not fully certain, so please confirm if that is not what you meant.');
    }

    if (policy.detailMode === 'short') {
      return cleanText(text, 320);
    }
    if (policy.detailMode === 'detailed') {
      return cleanText(text, 1600);
    }
    return cleanText(text);
  }

  static refineLegacyResponse(text, { result = {}, input = '', source = '', responseStyle = '' } = {}) {
    const baseText = cleanText(text);
    const policy = ResponseStyleManager.buildPolicy({
      baseText,
      result: { ...(result || {}), input: input || result?.input || '' },
      metadata: { input },
      source,
      responseStyle
    });
    const refined = ResponseStyleManager.composeResponse(baseText, result || {}, policy);
    return {
      text: refined || baseText,
      changed: Boolean(refined && refined !== baseText),
      policy,
      suggestions: policy.recovery?.suggestion ? [{ type: 'recovery', text: policy.recovery.suggestion }] : []
    };
  }
}

class ResponseQualityEvaluator extends BaseResponseGenerator {
  supports(context) {
    return super.supports(context) && context.configuration?.responseQuality !== false;
  }

  generate(context) {
    const before = context.currentText?.() ||
      context.futureExtensions.responseText ||
      context.futureExtensions.naturalLanguage ||
      context.baseText();
    const policy = context.futureExtensions.responsePolicy || ResponseStyleManager.buildPolicy({
      baseText: before,
      result: context.verificationResult || {},
      metadata: context.metadata || {},
      source: context.metadata?.source || context.verificationResult?.source || ''
    });
    const refined = this.refineText(before, context, policy);
    const quality = this.evaluate(refined, context, policy);

    context.futureExtensions.responseQuality = quality;
    context.diagnostics.quality?.(quality);

    if (refined && refined !== before) {
      context.setResponseText?.(refined);
    }

    const failedGates = quality.gates.filter(item => !item.passed);
    failedGates.forEach(item => {
      context.diagnostics.warn('Response quality gate needs attention.', {
        gate: item.name,
        reason: item.reason,
        responseType: context.responseType
      });
    });

    const recovery = policy.recovery?.suggestion;
    if (recovery && !context.suggestions.some(item => item.text === recovery)) {
      context.addSuggestion('recovery', recovery);
    }

    return context;
  }

  refineText(text, context, policy) {
    const result = context.verificationResult || {};
    let value = safeText(text);

    if (!value) {
      value = 'I do not have a clear response for that yet.';
    }

    if (/^completed\s+0,\s*failed\s+0,\s*skipped\s+0\.?$/i.test(value) || /^unknown\.?$/i.test(value)) {
      value = result.success === false
        ? 'I could not complete that request.'
        : 'Done.';
    }

    if (policy.responseKind === 'confirmation' && !/\b(?:yes|no|confirm|continue|cancel)\b/i.test(value)) {
      value = `${this.ensureSentence(value)} Say yes to continue or no to cancel.`;
    }

    if (policy.responseKind === 'error' && policy.recovery?.suggestion && !/\b(?:retry|try|check|provide|open|connect)\b/i.test(value)) {
      value = `${this.ensureSentence(value)} ${policy.recovery.suggestion}`;
    }

    if (policy.confidence?.label === 'low' && !UNCERTAINTY_PATTERN.test(value)) {
      value = `${this.ensureSentence(value)} I am not fully certain, so please confirm if that is not what you meant.`;
    }

    return this.ensureSentence(value, context.configuration?.maxChatLength || 2400);
  }

  evaluate(text, context, policy) {
    const value = compact(text);
    const result = context.verificationResult || {};
    const data = resultData(context);
    const lowConfidence = policy.confidence?.label === 'low';
    const privacySensitive = policy.privacy?.sensitive === true;
    const riskyConfirmation = policy.responseKind === 'confirmation' || result.requiresConfirmation;
    const needsClarification = policy.responseKind === 'clarification' || result.needsClarification;
    const failed = !needsClarification && !riskyConfirmation && (
      policy.responseKind === 'error' ||
      result.success === false ||
      (Array.isArray(result.failedActions) && result.failedActions.length > 0)
    );

    const gates = [
      gate('clarity', value.length > 0 && !/^status:\s*(unknown|completed)/i.test(value), 'Response should not expose raw status text.'),
      gate('specificity', !/^(?:done|ok|completed)\.?$/i.test(value) || Boolean(data.action || data.intent || result.intent), 'Short acknowledgements need action context when available.'),
      gate('clarification', !needsClarification || /\?|\b(?:what|which|when|who|where|how)\b/i.test(value), 'Clarifications should ask a concrete question.'),
      gate('confirmation', !riskyConfirmation || /\b(?:yes|no|confirm|continue|cancel)\b/i.test(value), 'Confirmations should make the user decision explicit.'),
      gate('recovery', !failed || /\b(?:could not|unable|failed|retry|try|check|provide|connect)\b/i.test(value), 'Failures should explain the problem or next step.'),
      gate('uncertainty', !lowConfidence || UNCERTAINTY_PATTERN.test(value), 'Low-confidence responses should expose uncertainty.'),
      gate('privacy', !privacySensitive || !SENSITIVE_VALUE_PATTERN.test(value), 'Sensitive values must not be exposed.'),
      gate('length', value.length <= Number(context.configuration?.maxChatLength || 2400), 'Response should fit the configured chat channel.')
    ];

    const passed = gates.filter(item => item.passed).length;
    const gateSummary = gates.reduce((summary, item) => {
      summary[item.name] = item.passed;
      return summary;
    }, {});
    return {
      version: '1.0.0',
      dimensions: ResponseStyleManager.dimensions(),
      score: Math.round((passed / gates.length) * 100) / 100,
      passed: passed === gates.length,
      gates,
      gateSummary,
      responseKind: policy.responseKind || context.responseType,
      detailMode: policy.detailMode || 'adaptive'
    };
  }
}

class ResponsePipeline {
  constructor(options = {}) {
    this.registry = options.registry || new ResponseRegistry();
    this.configuration = options.configuration instanceof ResponseConfiguration
      ? options.configuration
      : new ResponseConfiguration(options.configuration || {});
    this.logger = options.logger || null;
  }

  async run(verificationResult, options = {}) {
    const context = new ResponseContext({
      verificationResult,
      configuration: this.configuration,
      metadata: options.metadata || {}
    });
    if (this.configuration.enabled === false) return context.toAssistantResponse();

    for (const generator of this.registry.list({ includeDisabled: false })) {
      const started = Date.now();
      context.diagnostics.pipelineOrder.push(generator.id);
      try {
        if (!generator.initialized && typeof generator.initialize === 'function') await generator.initialize();
        if (generator.supports(context)) {
          await generator.generate(context);
        } else {
          context.diagnostics.warn('Response generator skipped by supports().', { generatorId: generator.id });
        }
      } catch (error) {
        const wrapped = new PipelineError(`Response generator failed: ${generator.id}`, { cause: error, context: { generatorId: generator.id } });
        context.diagnostics.error(wrapped);
        this.logger?.error?.('Response generator failed', { generatorId: generator.id, error: wrapped.message });
        if (this.configuration.strict) throw wrapped;
      } finally {
        const durationMs = Date.now() - started;
        context.diagnostics.time(generator.id, durationMs);
        if (durationMs > Number(this.configuration.maxGeneratorMs || 75)) {
          context.diagnostics.warn('Response generator exceeded timing budget.', {
            generatorId: generator.id,
            durationMs,
            maxGeneratorMs: this.configuration.maxGeneratorMs
          });
        }
        if (typeof generator.cleanup === 'function') {
          try {
            await generator.cleanup(context);
          } catch (cleanupError) {
            context.diagnostics.error(cleanupError, { generatorId: generator.id, phase: 'cleanup' });
          }
        }
      }
    }

    return context.toAssistantResponse();
  }
}

class ResponseManager {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof ResponseConfiguration
      ? options.configuration
      : new ResponseConfiguration(options.configuration || options);
    this.registry = options.registry || new ResponseRegistry();
    this.pipeline = options.pipeline || null;
    this.logger = options.logger || null;
    if (options.defaultGenerators !== false) this._registerDefaults();
  }

  _registerDefaults() {
    [
      [ConfirmationResponse, 'response.confirmation', 10],
      [SummaryResponse, 'response.summary', 20],
      [ErrorResponse, 'response.error', 30],
      [ClarificationResponse, 'response.clarification', 40],
      [SuggestionResponse, 'response.suggestion', 50],
      [ResponseStyleManager, 'response.styleManager', 55],
      [ResponseQualityEvaluator, 'response.qualityEvaluator', 57],
      [NaturalLanguageFormatter, 'response.naturalLanguageFormatter', 60],
      [ChatFormatter, 'response.chatFormatter', 80],
      [NotificationFormatter, 'response.notificationFormatter', 90]
    ].forEach(([Ctor, id, priority]) => {
      const configured = this.configuration.getGeneratorOptions(id, { priority });
      this.registry.register(new Ctor({ id, ...configured }), { id, priority: configured.priority, enabled: configured.enabled });
    });
  }

  registerGenerator(generator, options = {}) {
    this.registry.register(generator, options);
    return this;
  }

  async generate(verificationResult, options = {}) {
    if (!this.pipeline) {
      this.pipeline = new ResponsePipeline({ registry: this.registry, configuration: this.configuration, logger: this.logger });
    }
    return this.pipeline.run(verificationResult, options);
  }

  getStatus() {
    return {
      enabled: this.configuration.enabled,
      version: this.configuration.version,
      generatorCount: this.registry.count(),
      generators: this.registry.health()
    };
  }

  destroy() {
    for (const generator of this.registry.list()) generator.destroy?.();
    this.registry.clear();
    this.pipeline = null;
  }
}

function createDefaultResponseManager(options = {}) {
  return new ResponseManager(options);
}

module.exports = {
  ResponsePipeline,
  ResponseManager,
  createDefaultResponseManager,
  ResponseContext,
  ResponseRegistry,
  BaseResponseGenerator,
  ConfirmationResponse,
  SummaryResponse,
  ErrorResponse,
  ClarificationResponse,
  SuggestionResponse,
  ResponseStyleManager,
  ResponseQualityEvaluator,
  ChatFormatter,
  NotificationFormatter,
  NaturalLanguageFormatter,
  AssistantResponse,
  ResponseConfiguration,
  ResponseDiagnostics,
  ResponseLogger,
  ResponseGenerationError,
  FormattingError,
  ConfigurationError,
  PipelineError
};
