'use strict';

const BaseNormalizer = require('./BaseNormalizer');

class PunctuationNormalizer extends BaseNormalizer {
  normalize(context) {
    const next = String(context.workingText || '')
      .replace(/\.{3,}/g, '...')
      .replace(/\?{2,}/g, '?')
      .replace(/!{2,}/g, '!')
      .replace(/\s+([,.;:?!])/g, '$1')
      .replace(/([,;?!])([^\s,.;:?!])/g, '$1 $2')
      .trim();
    return context.setText(next, this.id);
  }
}

module.exports = PunctuationNormalizer;
