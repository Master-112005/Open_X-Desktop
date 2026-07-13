'use strict';

const BaseNormalizer = require('./BaseNormalizer');

const DEFAULT_ABBREVIATIONS = Object.freeze({
  appt: 'appointment',
  bt: 'bluetooth',
  cmd: 'command',
  dl: 'download',
  doc: 'document',
  docs: 'documents',
  img: 'image',
  imgs: 'images',
  mins: 'minutes',
  msgg: 'message',
  msg: 'message',
  mon: 'monday',
  sat: 'saturday',
  sun: 'sunday',
  pc: 'computer',
  pls: 'please',
  plz: 'please',
  rem: 'reminder',
  ss: 'screenshot',
  tmrw: 'tomorrow',
  txt: 'text',
  vid: 'video',
  vol: 'volume',
  wifi: 'wifi'
});

class AbbreviationExpander extends BaseNormalizer {
  constructor(options = {}) {
    super(options);
    this.dictionary = { ...DEFAULT_ABBREVIATIONS, ...(options.dictionaries?.abbreviations || options.abbreviations || {}) };
  }

  normalize(context) {
    const expansions = [];
    const next = String(context.workingText || '').replace(/\b[a-zA-Z]{2,}\b/g, token => {
      const replacement = this.dictionary[token.toLowerCase()];
      if (replacement && replacement !== token) expansions.push({ from: token, to: replacement });
      return replacement || token;
    });
    return context.setText(next, this.id, { expansions });
  }
}

module.exports = AbbreviationExpander;
