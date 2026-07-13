'use strict';

const BaseAnalyzer = require('./BaseAnalyzer');

const SUBORDINATORS = new Set(['because', 'if', 'when', 'while', 'although', 'after', 'before', 'since', 'unless', 'whereas']);
const COORDINATORS = new Set(['and', 'but', 'or', 'nor', 'yet', 'so']);
const RELATIVE = new Set(['who', 'which', 'that', 'whose', 'whom']);

class ClauseAnalyzer extends BaseAnalyzer {
  analyze(context) {
    const clauses = [];
    for (const sentence of context.sentences || []) {
      let startToken = sentence.startToken;
      for (let index = sentence.startToken; index <= sentence.endToken; index += 1) {
        const token = context.tokens[index];
        if (!token) continue;
        const lower = token.lower;
        const boundary = index > startToken && this._isBoundary(context, sentence, startToken, index, lower);
        if (!boundary) continue;
        clauses.push(this._buildClause(context, sentence, startToken, index - 1, clauses.length, lower));
        startToken = index;
      }
      if (startToken <= sentence.endToken) {
        clauses.push(this._buildClause(context, sentence, startToken, sentence.endToken, clauses.length, 'main'));
      }
    }
    context.clauses = clauses;
    return context;
  }

  _isBoundary(context, sentence, startToken, index, lower) {
    const token = context.tokens[index];
    const nextWord = this._nextWord(context.tokens, index + 1, sentence.endToken);
    if (token?.value === ',') return true;
    if (SUBORDINATORS.has(lower) || RELATIVE.has(lower)) return true;
    if (!COORDINATORS.has(lower)) return false;
    if (['but', 'or', 'so', 'yet'].includes(lower)) return true;
    if (lower === 'and') {
      const priorAction = context.tokens
        .slice(startToken, index)
        .some(item => item?.isAction || this.isActionToken(item?.lower));
      return priorAction && Boolean(nextWord && (nextWord.isAction || this.isActionToken(nextWord.lower)));
    }
    return Boolean(nextWord && (nextWord.isAction || this.isActionToken(nextWord.lower)));
  }

  _nextWord(tokens, start, end) {
    for (let index = start; index <= end; index += 1) {
      const token = tokens[index];
      if (token?.type === 'word') return token;
    }
    return null;
  }

  _buildClause(context, sentence, startToken, endToken, index, marker) {
    const tokens = context.tokens.slice(startToken, endToken + 1).filter(token => token.type !== 'punctuation' && token.type !== 'sentence-punctuation');
    const first = tokens[0]?.lower || marker;
    const actionToken = tokens.find(token => token.isAction || this.isActionToken(token.lower));
    let type = index === 0 ? 'main' : 'independent';
    if (SUBORDINATORS.has(first)) type = 'subordinate';
    if (COORDINATORS.has(first)) type = 'coordinate';
    if (RELATIVE.has(first)) type = 'relative';
    if (first === 'if' || first === 'unless') type = 'conditional';
    return {
      id: `clause_${index}`,
      sentenceId: sentence.id,
      index,
      type,
      startToken,
      endToken,
      parentId: index === 0 ? null : `clause_${Math.max(0, index - 1)}`,
      text: this.tokenText(tokens),
      actionToken: actionToken?.lower || null,
      tokenCount: tokens.length
    };
  }
}

module.exports = ClauseAnalyzer;
