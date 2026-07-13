'use strict';

const deepFreeze = require('../utils/ObjectFreeze');
const IdGenerator = require('../utils/IdGenerator');
const { sanitizeDetails } = require('../utils/ErrorHelpers');

const idGenerator = new IdGenerator({ prefix: 'assistant-request' });

function compactText(value, limit = 20000) {
  const text = String(value ?? '');
  return text.length > limit ? text.slice(0, limit) : text;
}

class AssistantRequest {
  constructor({ requestId, conversationId = '', input, source = 'chat', options = {}, metadata = {} } = {}) {
    this.requestId = String(requestId || idGenerator.next('request'));
    this.conversationId = String(conversationId || '');
    this.input = compactText(input);
    this.commandText = compactText(metadata.commandIntentText || metadata.normalizedInput || input).trim();
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

module.exports = AssistantRequest;
