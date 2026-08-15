'use strict';

const deepFreeze = require('../utils/ObjectFreeze');
const { sanitizeDetails } = require('../utils/ErrorHelpers');

function compactText(value, limit = 4000) {
  const text = String(value ?? '');
  return text.length > limit ? `${text.slice(0, Math.max(1, limit - 3)).trim()}...` : text;
}

class AssistantResponse {
  constructor({ success = false, response = '', result = null, metadata = {}, chatResponse = '' } = {}) {
    this.success = success === true;
    this.response = compactText(response || result?.response || chatResponse || '');
    this.chatResponse = compactText(chatResponse || result?.chatResponse || this.response, 4000);
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

module.exports = AssistantResponse;
