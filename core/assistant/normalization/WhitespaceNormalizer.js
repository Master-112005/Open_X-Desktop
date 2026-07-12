'use strict';

const BaseNormalizer = require('./BaseNormalizer');

class WhitespaceNormalizer extends BaseNormalizer {
  normalize(context) {
    const next = String(context.workingText || '')
      .replace(/[ \t\f\v]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return context.setText(next, this.id);
  }
}

module.exports = WhitespaceNormalizer;
