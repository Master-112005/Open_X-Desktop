'use strict';

const BaseInputAdapter = require('./BaseInputAdapter');

class ClipboardAdapter extends BaseInputAdapter {
  constructor(options = {}) {
    super({
      ...options,
      id: 'clipboard',
      source: 'clipboard',
      aliases: ['copy', 'paste'],
      sourceType: 'clipboard',
      priority: options.priority ?? 55,
      capabilities: ['text', 'clipboard']
    });
  }

  extractText(payload = {}) {
    if (typeof payload === 'string') return payload;
    return String(payload.clipboardText ?? payload.text ?? payload.input ?? '');
  }

  normalizeMetadata(metadata = {}) {
    return {
      ...metadata,
      clipboardSource: metadata.clipboardSource || null,
      clipboardType: metadata.clipboardType || 'text',
      partial: metadata.partial === true
    };
  }
}

module.exports = ClipboardAdapter;
