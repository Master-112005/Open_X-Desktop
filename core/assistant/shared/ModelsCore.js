'use strict';

const { deepFreeze, IdGenerator, sanitizeDetails } = require('./UtilsCore');

const MODELS_LAYER_VERSION = '1.1.0';

const assistantRequestIdGenerator = new IdGenerator({ prefix: 'assistant-request' });
const rawInputIdGenerator = new IdGenerator({ prefix: 'raw-input' });

const LEVELS = new Set(['debug', 'info', 'warn', 'error']);
const STATUSES = new Set(['pending', 'running', 'completed', 'failed', 'cancelled', 'skipped']);

function truncateText(value, limit = 20000) {
  const text = String(value ?? '');
  return text.length > limit ? text.slice(0, limit) : text;
}

function compactResponseText(value, limit = 4000) {
  const text = String(value ?? '');
  return text.length > limit ? `${text.slice(0, Math.max(1, limit - 3)).trim()}...` : text;
}

function compactAttachment(attachment = {}) {
  if (!attachment || typeof attachment !== 'object') return attachment;
  return sanitizeDetails({
    id: attachment.id,
    name: attachment.name,
    type: attachment.type,
    mimeType: attachment.mimeType,
    size: attachment.size,
    path: attachment.path,
    uri: attachment.uri
  });
}

function tokenize(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).slice(0, 500);
}

// --- Models ---

class AssistantRequest {
  constructor({ requestId, conversationId = '', input, source = 'chat', options = {}, metadata = {} } = {}) {
    this.requestId = String(requestId || assistantRequestIdGenerator.next('request'));
    this.conversationId = String(conversationId || '');
    this.input = truncateText(input);
    this.commandText = truncateText(metadata.commandIntentText || metadata.normalizedInput || input).trim();
    this.source = String(source || 'chat');
    this.options = sanitizeDetails(options || {});
    this.metadata = sanitizeDetails(metadata || {});
    this.createdAt = Number(metadata.createdAt) || Date.now();
    deepFreeze(this);
  }

  isEmpty() {
    return this.input.trim().length === 0;
  }

  isFromPhone() {
    return this.source === 'phone' || this.source === 'mobile';
  }

  toJSON() {
    return {
      requestId: this.requestId,
      conversationId: this.conversationId,
      input: this.input,
      commandText: this.commandText,
      source: this.source,
      options: this.options,
      metadata: this.metadata,
      createdAt: this.createdAt
    };
  }
}

class AssistantResponse {
  constructor({ success = false, response = '', result = null, metadata = {}, chatResponse = '' } = {}) {
    this.success = success === true;
    this.response = compactResponseText(response || result?.response || chatResponse || '');
    this.chatResponse = compactResponseText(chatResponse || result?.chatResponse || this.response, 4000);
    this.result = sanitizeDetails(result || null);
    this.metadata = sanitizeDetails(metadata || {});
    this.createdAt = Date.now();
    deepFreeze(this);
  }

  isEmpty() {
    return this.response.trim().length === 0;
  }

  toJSON() {
    return {
      success: this.success,
      response: this.response,
      chatResponse: this.chatResponse,
      result: this.result,
      metadata: this.metadata,
      createdAt: this.createdAt
    };
  }
}

class DiagnosticRecord {
  constructor({ level = 'info', message = '', code = '', data = {}, timestamp = Date.now() } = {}) {
    const normalizedLevel = String(level || 'info').toLowerCase();
    this.level = LEVELS.has(normalizedLevel) ? normalizedLevel : 'info';
    this.message = String(message || '');
    this.code = String(code || '');
    this.data = sanitizeDetails(data || {});
    this.timestamp = Number(timestamp) || Date.now();
    deepFreeze(this);
  }

  get isError() {
    return this.level === 'error';
  }

  toJSON() {
    return {
      level: this.level,
      message: this.message,
      code: this.code,
      data: this.data,
      timestamp: this.timestamp
    };
  }
}

class ExecutionMetadata {
  constructor({ status = 'pending', startedAt = null, finishedAt = null, durationMs = 0, attempt = 1, executor = '', error = null } = {}) {
    const normalizedStatus = String(status || 'pending').toLowerCase();
    this.status = STATUSES.has(normalizedStatus) ? normalizedStatus : 'pending';
    this.startedAt = startedAt;
    this.finishedAt = finishedAt;
    this.durationMs = Math.max(0, Number(durationMs) || 0);
    this.attempt = Math.max(1, Number(attempt) || 1);
    this.executor = String(executor || '');
    this.error = error ? {
      name: error.name || 'Error',
      message: String(error.message || error)
    } : null;
    deepFreeze(this);
  }

  get terminal() {
    return ['completed', 'failed', 'cancelled', 'skipped'].includes(this.status);
  }

  toJSON() {
    return {
      status: this.status,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      durationMs: this.durationMs,
      attempt: this.attempt,
      executor: this.executor,
      error: this.error
    };
  }
}

class PipelineMetadata {
  constructor(values = {}, options = {}) {
    this.maxEntries = Math.max(10, Number(options.maxEntries) || 200);
    this.values = sanitizeDetails(values || {});
  }

  set(key, value) {
    const normalizedKey = String(key);
    if (Object.keys(this.values).length >= this.maxEntries && !Object.prototype.hasOwnProperty.call(this.values, normalizedKey)) {
      const firstKey = Object.keys(this.values).find(item => !item.startsWith('assistant.')) || Object.keys(this.values)[0];
      delete this.values[firstKey];
    }
    this.values[normalizedKey] = sanitizeDetails(value);
    return this;
  }

  get(key, fallback = undefined) {
    const normalizedKey = String(key);
    return Object.prototype.hasOwnProperty.call(this.values, normalizedKey) ? this.values[normalizedKey] : fallback;
  }

  has(key) {
    return Object.prototype.hasOwnProperty.call(this.values, String(key));
  }

  delete(key) {
    return delete this.values[String(key)];
  }

  merge(values = {}) {
    for (const [key, value] of Object.entries(values || {})) this.set(key, value);
    return this;
  }

  toJSON() {
    return { ...this.values };
  }
}

class ProcessedInput {
  constructor({ raw = '', normalized = '', commandText = '', source = 'chat', metadata = {}, tokens = [] } = {}) {
    this.raw = String(raw || '');
    this.normalized = String(normalized || raw || '');
    this.commandText = String(commandText || metadata.commandIntentText || this.normalized).trim();
    this.source = String(source || 'chat');
    this.tokens = Array.isArray(tokens) && tokens.length ? tokens.slice(0, 500) : tokenize(this.commandText);
    this.metadata = sanitizeDetails(metadata || {});
    deepFreeze(this);
  }

  isEmpty() {
    return this.commandText.length === 0;
  }

  toJSON() {
    return {
      raw: this.raw,
      normalized: this.normalized,
      commandText: this.commandText,
      source: this.source,
      tokens: this.tokens,
      metadata: this.metadata
    };
  }
}

class RawUserInput {
  constructor({
    id = '',
    conversationId = '',
    sessionId = '',
    requestId = '',
    timestamp = Date.now(),
    source = 'chat',
    sourceType = '',
    rawText = '',
    text = '',
    language = null,
    confidence = 1,
    attachments = [],
    metadata = {},
    device = null,
    platform = null,
    userContext = {},
    flags = {},
    diagnostics = [],
    futureExtensions = {},
    receivedAt = null,
    options = {}
  } = {}) {
    const resolvedText = truncateText(rawText || text || '');
    const resolvedId = String(id || requestId || rawInputIdGenerator.next('request'));
    this.id = resolvedId;
    this.conversationId = String(conversationId || '');
    this.sessionId = String(sessionId || '');
    this.requestId = String(requestId || resolvedId);
    this.timestamp = Number(timestamp || receivedAt) || Date.now();
    this.source = String(source || 'chat');
    this.sourceType = String(sourceType || source || 'chat');
    this.rawText = resolvedText;
    this.text = resolvedText;
    this.language = language && typeof language === 'object' ? { ...language } : null;
    this.confidence = Math.max(0, Math.min(1, Number(confidence)));
    this.attachments = Array.isArray(attachments) ? attachments.slice(0, 20).map(compactAttachment) : [];
    this.metadata = sanitizeDetails(metadata || {});
    this.device = device && typeof device === 'object' ? sanitizeDetails(device) : null;
    this.platform = platform && typeof platform === 'object' ? sanitizeDetails(platform) : null;
    this.userContext = sanitizeDetails(userContext || {});
    this.flags = sanitizeDetails(flags || {});
    this.diagnostics = Array.isArray(diagnostics) ? diagnostics.slice(-100).map(item => sanitizeDetails(item)) : [];
    this.futureExtensions = sanitizeDetails(futureExtensions || {});
    this.receivedAt = this.timestamp;
    this.options = sanitizeDetails(options || {});
    deepFreeze(this);
  }

  isEmpty() {
    return this.rawText.trim().length === 0;
  }

  isFromPhone() {
    return this.source === 'phone' || this.source === 'mobile';
  }

  toJSON() {
    return {
      id: this.id,
      conversationId: this.conversationId,
      sessionId: this.sessionId,
      requestId: this.requestId,
      timestamp: this.timestamp,
      source: this.source,
      sourceType: this.sourceType,
      rawText: this.rawText,
      text: this.text,
      language: this.language,
      confidence: this.confidence,
      attachments: this.attachments,
      metadata: this.metadata,
      device: this.device,
      platform: this.platform,
      userContext: this.userContext,
      flags: this.flags,
      diagnostics: this.diagnostics,
      futureExtensions: this.futureExtensions,
      receivedAt: this.receivedAt,
      options: this.options
    };
  }
}

class StageMetadata {
  constructor({ id = '', name = '', order = 0, enabled = true, tags = [], timeoutMs = 0, version = '1.0.0', requiredInputs = [] } = {}) {
    this.id = String(id || name || '');
    this.name = String(name || id || '');
    this.order = Number(order) || 0;
    this.enabled = enabled !== false;
    this.tags = Array.isArray(tags) ? tags.slice() : [];
    this.timeoutMs = Math.max(0, Number(timeoutMs) || 0);
    this.version = String(version || '1.0.0');
    this.requiredInputs = Array.isArray(requiredInputs) ? requiredInputs.map(String) : [];
    deepFreeze(this);
  }

  hasTag(tag) {
    return this.tags.includes(String(tag));
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      order: this.order,
      enabled: this.enabled,
      tags: this.tags,
      timeoutMs: this.timeoutMs,
      version: this.version,
      requiredInputs: this.requiredInputs
    };
  }
}

class TimingInformation {
  constructor({ startedAt = Date.now(), finishedAt = null, durationMs = 0, stages = [] } = {}) {
    this.startedAt = startedAt;
    this.finishedAt = finishedAt;
    this.durationMs = Math.max(0, Number(durationMs) || 0);
    this.stages = Array.isArray(stages)
      ? stages.slice(-200).map(stage => ({
        stageId: String(stage.stageId || stage.id || ''),
        durationMs: Math.max(0, Number(stage.durationMs) || 0),
        success: stage.success !== false
      }))
      : [];
    this.stageDurationMs = this.stages.reduce((sum, stage) => sum + stage.durationMs, 0);
    this.slowestStage = this.stages.reduce((slowest, stage) => (
      !slowest || stage.durationMs > slowest.durationMs ? stage : slowest
    ), null);
    deepFreeze(this);
  }

  toJSON() {
    return {
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      durationMs: this.durationMs,
      stages: this.stages,
      stageDurationMs: this.stageDurationMs,
      slowestStage: this.slowestStage
    };
  }
}

module.exports = {
  MODELS_LAYER_VERSION,
  AssistantRequest,
  AssistantResponse,
  DiagnosticRecord,
  ExecutionMetadata,
  PipelineMetadata,
  ProcessedInput,
  RawUserInput,
  StageMetadata,
  TimingInformation
};