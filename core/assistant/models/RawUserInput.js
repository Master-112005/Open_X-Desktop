'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

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
    const resolvedText = String(rawText || text || '');
    this.id = String(id || requestId || '');
    this.conversationId = String(conversationId || '');
    this.sessionId = String(sessionId || '');
    this.requestId = String(requestId || id || '');
    this.timestamp = Number(timestamp || receivedAt) || Date.now();
    this.source = String(source || 'chat');
    this.sourceType = String(sourceType || source || 'chat');
    this.rawText = resolvedText;
    this.text = resolvedText;
    this.language = language && typeof language === 'object' ? { ...language } : null;
    this.confidence = Math.max(0, Math.min(1, Number(confidence)));
    this.attachments = Array.isArray(attachments) ? attachments.slice() : [];
    this.metadata = { ...(metadata || {}) };
    this.device = device && typeof device === 'object' ? { ...device } : null;
    this.platform = platform && typeof platform === 'object' ? { ...platform } : null;
    this.userContext = { ...(userContext || {}) };
    this.flags = { ...(flags || {}) };
    this.diagnostics = Array.isArray(diagnostics) ? diagnostics.slice() : [];
    this.futureExtensions = { ...(futureExtensions || {}) };
    this.receivedAt = this.timestamp;
    this.options = { ...(options || {}) };
    deepFreeze(this);
  }
}

module.exports = RawUserInput;
