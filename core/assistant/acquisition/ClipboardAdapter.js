'use strict';

const BaseInputAdapter = require('./BaseInputAdapter');

class ClipboardAdapter extends BaseInputAdapter {
  constructor(options = {}) {
    super({ ...options, id: 'clipboard', source: 'clipboard', sourceType: 'clipboard', priority: options.priority ?? 55 });
  }

  extractText(payload = {}) {
    if (typeof payload === 'string') return payload;
    return String(payload.clipboardText ?? payload.text ?? payload.input ?? '');
  }

  normalizeMetadata(metadata = {}) {
    return {
      ...metadata,
      clipboardSource: metadata.clipboardSource || null,
      clipboardType: metadata.clipboardType || 'text'
    };
  }
}

module.exports = ClipboardAdapter;
