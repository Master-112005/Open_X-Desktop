'use strict';

const BaseAnalyzer = require('./BaseAnalyzer');

const TOKEN_PATTERN = /"[^"]*"|'[^']*'|\p{Emoji_Presentation}|\d+(?:[:.]\d+)?|[A-Za-z]+(?:'[A-Za-z]+)?|[^\s]/gu;

function classifyToken(value) {
  if (/^["'].*["']$/u.test(value)) return 'quote';
  if (/^\p{Emoji_Presentation}$/u.test(value)) return 'emoji';
  if (/^\d+(?:[:.]\d+)?$/u.test(value)) return 'number';
  if (/^[A-Za-z]+(?:'[A-Za-z]+)?$/u.test(value)) return 'word';
  if (/^[.!?]$/u.test(value)) return 'sentence-punctuation';
  if (/^[,;:]$/u.test(value)) return 'punctuation';
  return 'symbol';
}

class Tokenizer extends BaseAnalyzer {
  analyze(context) {
    const text = String(context.normalizedSentence || '');
    const tokens = [];
    let match;
    while ((match = TOKEN_PATTERN.exec(text)) !== null) {
      tokens.push({
        id: `tok_${tokens.length}`,
        index: tokens.length,
        value: match[0],
        lower: match[0].toLowerCase(),
        type: classifyToken(match[0]),
        start: match.index,
        end: match.index + match[0].length
      });
    }
    context.tokens = tokens;
    context.addDiagnostic({ analyzerId: this.id, message: 'Tokens produced.', data: { count: tokens.length } });
    return context;
  }
}

module.exports = Tokenizer;
