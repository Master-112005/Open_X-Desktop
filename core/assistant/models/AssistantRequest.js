'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

class AssistantRequest {
  constructor({ requestId, conversationId = '', input, source = 'chat', options = {}, metadata = {} } = {}) {
    this.requestId = String(requestId || '');
    this.conversationId = String(conversationId || '');
    this.input = input;
    this.source = String(source || 'chat');
    this.options = { ...(options || {}) };
    this.metadata = { ...(metadata || {}) };
    deepFreeze(this);
  }
}

module.exports = AssistantRequest;
