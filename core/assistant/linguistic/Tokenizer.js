'use strict';

const BaseAnalyzer = require('./BaseAnalyzer');

const TOKEN_PATTERN = /"[^"]*"|'[^']*'|\p{Emoji_Presentation}|\d+(?:[:.]\d+)?%?|[A-Za-z]+(?:[-'][A-Za-z]+)?|[^\s]/gu;

function classifyToken(value) {
  if (/^["'].*["']$/u.test(value)) return 'quote';
  if (/^\p{Emoji_Presentation}$/u.test(value)) return 'emoji';
  if (/^\d+(?:[:.]\d+)?$/u.test(value)) return 'number';
  if (/^[A-Za-z]+(?:'[A-Za-z]+)?$/u.test(value)) return 'word';
  if (/^[.!?]$/u.test(value)) return 'sentence-punctuation';
  if (/^[,;:]$/u.test(value)) return 'punctuation';
  return 'symbol';
}

function classifyShape(value) {
  if (/^\d/.test(value)) return 'number';
  if (/^[A-Z][a-z]+$/.test(value)) return 'title';
  if (/^[A-Z]+$/.test(value)) return 'upper';
  if (/^[a-z]+$/.test(value)) return 'lower';
  return 'mixed';
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
        shape: classifyShape(match[0]),
        isAction: this.isActionToken(match[0]),
        start: match.index,
        end: match.index + match[0].length
      });
    }
    const limit = Number(context.configuration?.maxTokens || 512);
    context.tokens = tokens.slice(0, limit);
    if (tokens.length > context.tokens.length) {
      context.addWarning('Input token stream truncated for linguistic analysis.', {
        originalCount: tokens.length,
        retainedCount: context.tokens.length
      });
    }
    context.addDiagnostic({ analyzerId: this.id, message: 'Tokens produced.', data: { count: context.tokens.length } });
    return context;
  }
}

module.exports = Tokenizer;
