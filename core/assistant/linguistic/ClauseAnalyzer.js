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
        const boundary = index > startToken && (token.value === ',' || SUBORDINATORS.has(lower) || COORDINATORS.has(lower) || RELATIVE.has(lower));
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

  _buildClause(context, sentence, startToken, endToken, index, marker) {
    const tokens = context.tokens.slice(startToken, endToken + 1).filter(token => token.type !== 'punctuation' && token.type !== 'sentence-punctuation');
    const first = tokens[0]?.lower || marker;
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
      text: tokens.map(token => token.value).join(' ')
    };
  }
}

module.exports = ClauseAnalyzer;
