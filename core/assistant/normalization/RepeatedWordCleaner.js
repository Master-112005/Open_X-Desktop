'use strict';

const BaseNormalizer = require('./BaseNormalizer');

const PRESERVE_REPEATED = new Set(['no', 'yes', 'ok', 'okay', 'stop', 'wait']);

class RepeatedWordCleaner extends BaseNormalizer {
  normalize(context) {
    const collapsed = [];
    const tokens = String(context.workingText || '').split(/(\s+)/);
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      const previousWord = collapsed.slice().reverse().find(item => !/^\s+$/.test(item));
      const isWord = /^[a-zA-Z][\w'-]*$/.test(token);
      if (isWord && previousWord && previousWord.toLowerCase() === token.toLowerCase() && !PRESERVE_REPEATED.has(token.toLowerCase())) {
        continue;
      }
      collapsed.push(token);
    }
    const next = collapsed.join('');
    return context.setText(next, this.id, { preservedRepeatedWords: [...PRESERVE_REPEATED] });
  }
}

module.exports = RepeatedWordCleaner;
