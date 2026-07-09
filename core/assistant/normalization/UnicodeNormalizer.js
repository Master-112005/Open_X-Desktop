'use strict';

const BaseNormalizer = require('./BaseNormalizer');

const PUNCTUATION_MAP = Object.freeze({
  '\u2018': "'",
  '\u2019': "'",
  '\u201A': "'",
  '\u201B': "'",
  '\u201C': '"',
  '\u201D': '"',
  '\u201E': '"',
  '\u201F': '"',
  '\u2013': '-',
  '\u2014': '-',
  '\u2212': '-',
  '\u00A0': ' '
});

class UnicodeNormalizer extends BaseNormalizer {
  normalize(context) {
    let next = String(context.workingText || '').normalize('NFC');
    next = next.replace(/[\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u201F\u2013\u2014\u2212\u00A0]/g, char => PUNCTUATION_MAP[char] || char);
    return context.setText(next, this.id);
  }
}

module.exports = UnicodeNormalizer;
