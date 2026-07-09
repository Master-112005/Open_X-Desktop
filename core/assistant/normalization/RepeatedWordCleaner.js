'use strict';

const BaseNormalizer = require('./BaseNormalizer');

class RepeatedWordCleaner extends BaseNormalizer {
  normalize(context) {
    const next = String(context.workingText || '').replace(/\b([a-zA-Z][\w'-]*)\b(?:\s+\1\b){1,}/gi, '$1');
    return context.setText(next, this.id);
  }
}

module.exports = RepeatedWordCleaner;
