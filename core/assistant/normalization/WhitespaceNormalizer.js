'use strict';

const BaseNormalizer = require('./BaseNormalizer');

class WhitespaceNormalizer extends BaseNormalizer {
  normalize(context) {
    const next = String(context.workingText || '')
      .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
      .replace(/[ \t\f\v]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return context.setText(next, this.id, { collapsedWhitespace: next !== String(context.workingText || '') });
  }
}

module.exports = WhitespaceNormalizer;
