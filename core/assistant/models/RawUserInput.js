'use strict';

const deepFreeze = require('../utils/ObjectFreeze');
const IdGenerator = require('../utils/IdGenerator');
const { sanitizeDetails } = require('../utils/ErrorHelpers');

const idGenerator = new IdGenerator({ prefix: 'raw-input' });

function compactText(value, limit = 20000) {
  const text = String(value ?? '');
  return text.length > limit ? text.slice(0, limit) : text;
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
    const resolvedText = compactText(rawText || text || '');
    const resolvedId = String(id || requestId || idGenerator.next('request'));
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

module.exports = RawUserInput;
