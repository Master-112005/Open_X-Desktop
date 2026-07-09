'use strict';

const BaseInputAdapter = require('./BaseInputAdapter');

class OCRAdapter extends BaseInputAdapter {
  constructor(options = {}) {
    super({ ...options, id: 'ocr', source: 'ocr', sourceType: 'ocr-text', priority: options.priority ?? 50 });
  }

  extractText(payload = {}) {
    if (typeof payload === 'string') return payload;
    return String(payload.extractedText ?? payload.text ?? payload.input ?? '');
  }

  normalizeMetadata(metadata = {}) {
    return {
      ...metadata,
      ocrConfidence: metadata.ocrConfidence ?? metadata.confidence ?? null,
      imageSource: metadata.imageSource || null
    };
  }
}

module.exports = OCRAdapter;
