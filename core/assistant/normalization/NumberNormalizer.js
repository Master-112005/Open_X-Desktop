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

const MAGNITUDES = Object.freeze({
  hundred: 100,
  thousand: 1000
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

const MULTIPLIERS = Object.freeze({
  half: 0.5,
  quarter: 0.25,
  double: 2,
  triple: 3
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
  const filtered = words.filter(word => word && word !== 'and');
  if (filtered.length !== words.length) return parseNumberWords(filtered);
  if (words.length === 1) {
    return SMALL[words[0]] ?? TENS[words[0]] ?? ORDINALS[words[0]] ?? MULTIPLIERS[words[0]] ?? null;
  }
  if (words.length === 2 && SMALL[words[0]] !== undefined && MAGNITUDES[words[1]]) {
    return SMALL[words[0]] * MAGNITUDES[words[1]];
  }
  if (words.length === 3 && SMALL[words[0]] !== undefined && MAGNITUDES[words[1]] && SMALL[words[2]] !== undefined) {
    return (SMALL[words[0]] * MAGNITUDES[words[1]]) + SMALL[words[2]];
  }
  if (words.length === 2 && TENS[words[0]] && SMALL[words[1]] !== undefined) {
    return TENS[words[0]] + SMALL[words[1]];
  }
  return null;
}

class NumberNormalizer extends BaseNormalizer {
  normalize(context) {
    const tokens = String(context.workingText || '').replace(/([a-z]+)-([a-z]+)/gi, '$1 $2').split(/(\s+)/);
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
      const thirdWord = String(tokens[index + 4] || '').toLowerCase().replace(/[^a-z]/g, '');
      const fourthWord = String(tokens[index + 6] || '').toLowerCase().replace(/[^a-z]/g, '');
      const numeric = token.match(/^(\d+(?:\.\d+)?)(st|nd|rd|th|%)?$/i);
      if (numeric) {
        context.addObservation('numbers', {
          original: token,
          value: Number(numeric[1]),
          type: numeric[2] === '%' ? 'percentage' : numeric[2] ? 'ordinal' : 'numeric'
        });
        output.push(token);
        continue;
      }
      if (/^[IVX]{2,}$/u.test(token)) {
        const romanValue = ROMAN[token.toLowerCase()] ?? null;
        if (romanValue !== null) {
          context.addObservation('numbers', { original: token, value: romanValue, type: 'roman' });
          output.push(rewriteText ? String(romanValue) : token);
          continue;
        }
      }
      const four = parseNumberWords([word, nextWord, thirdWord, fourthWord]);
      if (four !== null && nextWord && thirdWord && fourthWord) {
        context.addObservation('numbers', { original: `${token} ${tokens[index + 2]} ${tokens[index + 4]} ${tokens[index + 6]}`, value: four });
        if (rewriteText) {
          output.push(String(four));
          index += 6;
        } else {
          output.push(token);
        }
        continue;
      }
      const three = parseNumberWords([word, nextWord, thirdWord]);
      if (three !== null && nextWord && thirdWord) {
        context.addObservation('numbers', { original: `${token} ${tokens[index + 2]} ${tokens[index + 4]}`, value: three });
        if (rewriteText) {
          output.push(String(three));
          index += 4;
        } else {
          output.push(token);
        }
        continue;
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
    return context.setText(output.join(''), this.id, { rewriteText });
  }
}

module.exports = NumberNormalizer;
