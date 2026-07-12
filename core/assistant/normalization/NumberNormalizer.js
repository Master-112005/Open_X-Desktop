'use strict';

const BaseNormalizer = require('./BaseNormalizer');

const SMALL = Object.freeze({
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19
});

const TENS = Object.freeze({
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90
});

const ORDINALS = Object.freeze({
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20
});

const ROMAN = Object.freeze({
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10
});

function parseNumberWords(words) {
  if (!words.length) return null;
  if (words.length === 1) {
    return SMALL[words[0]] ?? TENS[words[0]] ?? ORDINALS[words[0]] ?? null;
  }
  if (words.length === 2 && TENS[words[0]] && SMALL[words[1]] !== undefined) {
    return TENS[words[0]] + SMALL[words[1]];
  }
  return null;
}

class NumberNormalizer extends BaseNormalizer {
  normalize(context) {
    const tokens = String(context.workingText || '').split(/(\s+)/);
    const output = [];
    const rewriteText = this.options.rewriteText === true;
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (/^\s+$/.test(token)) {
        output.push(token);
        continue;
      }
      const word = token.toLowerCase().replace(/[^a-z]/g, '');
      const nextWord = String(tokens[index + 2] || '').toLowerCase().replace(/[^a-z]/g, '');
      if (/^[IVX]{2,}$/u.test(token)) {
        const romanValue = ROMAN[token.toLowerCase()] ?? null;
        if (romanValue !== null) {
          context.addObservation('numbers', { original: token, value: romanValue, type: 'roman' });
          output.push(rewriteText ? String(romanValue) : token);
          continue;
        }
      }
      const two = parseNumberWords([word, nextWord]);
      if (two !== null && nextWord) {
        context.addObservation('numbers', { original: `${token} ${tokens[index + 2]}`, value: two });
        if (rewriteText) {
          output.push(String(two));
          index += 2;
        } else {
          output.push(token);
        }
        continue;
      }
      const one = parseNumberWords([word]);
      if (one !== null) {
        context.addObservation('numbers', { original: token, value: one });
        output.push(rewriteText ? String(one) : token);
        continue;
      }
      output.push(token);
    }
    return context.setText(output.join(''), this.id);
  }
}

module.exports = NumberNormalizer;
