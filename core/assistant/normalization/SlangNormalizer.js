'use strict';

const BaseNormalizer = require('./BaseNormalizer');

const DEFAULT_SLANG = Object.freeze({
  bro: '',
  bruh: '',
  cuz: 'because',
  gonna: 'going to',
  gotta: 'got to',
  wanna: 'want to',
  kinda: 'kind of',
  lemme: 'let me',
  msg: 'message',
  pls: 'please',
  plz: 'please',
  rn: 'right now',
  ya: 'you'
});

class SlangNormalizer extends BaseNormalizer {
  constructor(options = {}) {
    super(options);
    this.dictionary = { ...DEFAULT_SLANG, ...(options.dictionaries?.slang || options.slang || {}) };
  }

  normalize(context) {
    const replacements = [];
    const next = String(context.workingText || '').replace(/\b[a-zA-Z']+\b/g, token => {
      const key = token.toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(this.dictionary, key)) return token;
      replacements.push({ from: token, to: this.dictionary[key] });
      return this.dictionary[key];
    }).replace(/[ \t]{2,}/g, ' ').trim();
    return context.setText(next, this.id, { replacements });
  }
}

module.exports = SlangNormalizer;
