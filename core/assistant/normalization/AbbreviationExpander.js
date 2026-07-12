'use strict';

const BaseNormalizer = require('./BaseNormalizer');

const DEFAULT_ABBREVIATIONS = Object.freeze({
  appt: 'appointment',
  cmd: 'command',
  msg: 'message',
  pls: 'please',
  plz: 'please',
  rem: 'reminder'
});

class AbbreviationExpander extends BaseNormalizer {
  constructor(options = {}) {
    super(options);
    this.dictionary = { ...DEFAULT_ABBREVIATIONS, ...(options.dictionaries?.abbreviations || options.abbreviations || {}) };
  }

  normalize(context) {
    const next = String(context.workingText || '').replace(/\b[a-zA-Z]{2,}\b/g, token => {
      const replacement = this.dictionary[token.toLowerCase()];
      return replacement || token;
    });
    return context.setText(next, this.id);
  }
}

module.exports = AbbreviationExpander;
