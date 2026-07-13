'use strict';

const { normalizeSourceName } = require('./AcquisitionSanitizer');

const SOURCE_ALIASES = Object.freeze({
  android: 'phone',
  copy: 'clipboard',
  desktop: 'chat',
  dictation: 'voice',
  extension: 'plugin',
  'image-text': 'ocr',
  ios: 'phone',
  mobile: 'phone',
  'mobile-cloud': 'cloud',
  paste: 'clipboard',
  relay: 'cloud',
  rest: 'api',
  screen: 'ocr',
  'screen-text': 'ocr',
  speech: 'voice',
  text: 'chat'
});

class SourceNormalizer {
  constructor(options = {}) {
    this.aliases = {
      ...SOURCE_ALIASES,
      ...(options.aliases || {})
    };
  }

  normalize(source = 'chat') {
    const key = normalizeSourceName(source, 'chat');
    return this.aliases[key] || key;
  }
}

module.exports = SourceNormalizer;
