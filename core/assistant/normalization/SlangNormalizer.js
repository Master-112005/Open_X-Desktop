'use strict';

const BaseNormalizer = require('./BaseNormalizer');

const DEFAULT_SLANG = Object.freeze({
  gonna: 'going to',
  gotta: 'got to',
  wanna: 'want to'
});

class SlangNormalizer extends BaseNormalizer {
  constructor(options = {}) {
    super(options);
    this.dictionary = { ...DEFAULT_SLANG, ...(options.dictionaries?.slang || options.slang || {}) };
  }

  normalize(context) {
    const next = String(context.workingText || '').replace(/\b[a-zA-Z']+\b/g, token => {
      const replacement = this.dictionary[token.toLowerCase()];
      return replacement || token;
    });
    return context.setText(next, this.id);
  }
}

module.exports = SlangNormalizer;
