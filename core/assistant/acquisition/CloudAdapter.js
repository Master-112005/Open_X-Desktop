'use strict';

const BaseInputAdapter = require('./BaseInputAdapter');

class CloudAdapter extends BaseInputAdapter {
  constructor(options = {}) {
    super({ ...options, id: 'cloud', source: 'cloud', sourceType: 'cloud-relay', priority: options.priority ?? 85 });
  }

  extractText(payload = {}) {
    if (typeof payload === 'string') return payload;
    return String(payload.command ?? payload.payload?.command ?? payload.message ?? payload.text ?? payload.input ?? '');
  }

  normalizeMetadata(metadata = {}) {
    return {
      ...metadata,
      cloudSession: metadata.cloudSession || metadata.cloudRequestId || null,
      relay: metadata.relay || metadata.relayUrl || null
    };
  }
}

module.exports = CloudAdapter;
