'use strict';

const BaseInputAdapter = require('./BaseInputAdapter');

class CloudAdapter extends BaseInputAdapter {
  constructor(options = {}) {
    super({
      ...options,
      id: 'cloud',
      source: 'cloud',
      aliases: ['relay', 'mobile-cloud'],
      sourceType: 'cloud-relay',
      priority: options.priority ?? 85,
      capabilities: ['text', 'cloud-command']
    });
  }

  extractText(payload = {}) {
    if (typeof payload === 'string') return payload;
    return String(payload.command ?? payload.payload?.command ?? payload.message ?? payload.text ?? payload.input ?? '');
  }

  normalizeMetadata(metadata = {}) {
    return {
      ...metadata,
      cloudSession: metadata.cloudSession || metadata.cloudRequestId || null,
      relay: metadata.relay || metadata.relayUrl || null,
      encrypted: metadata.encrypted === true,
      relayConnected: metadata.relayConnected !== false
    };
  }
}

module.exports = CloudAdapter;
