'use strict';

const BaseInputAdapter = require('./BaseInputAdapter');

class OCRAdapter extends BaseInputAdapter {
  constructor(options = {}) {
    super({
      ...options,
      id: 'ocr',
      source: 'ocr',
      aliases: ['image-text', 'screen-text'],
      sourceType: 'ocr-text',
      priority: options.priority ?? 50,
      capabilities: ['text', 'ocr']
    });
  }

  extractText(payload = {}) {
    if (typeof payload === 'string') return payload;
    return String(payload.extractedText ?? payload.text ?? payload.input ?? '');
  }

  normalizeMetadata(metadata = {}) {
    return {
      ...metadata,
      ocrConfidence: metadata.ocrConfidence ?? metadata.confidence ?? null,
      imageSource: metadata.imageSource || null,
      partial: metadata.partial === true
    };
  }
}

module.exports = OCRAdapter;
