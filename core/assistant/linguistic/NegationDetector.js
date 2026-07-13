'use strict';

const BaseAnalyzer = require('./BaseAnalyzer');

const NEGATIONS = new Set(['not', 'never', 'no', 'cannot', "can't", "don't", "doesn't", "didn't", "isn't", "aren't", 'without']);
const CORRECTIONS = new Set(['actually', 'instead']);

class NegationDetector extends BaseAnalyzer {
  analyze(context) {
    const tags = context.posTags || [];
    context.negations = (context.tokens || [])
      .filter(token => NEGATIONS.has(token.lower) || CORRECTIONS.has(token.lower))
      .map(token => {
        const scopedVerb = tags.find(tag => tag.index > token.index && ['verb', 'auxiliary', 'modal'].includes(tag.tag));
        const next = context.tokens[token.index + 1];
        const text = String(context.normalizedSentence || '').toLowerCase();
        const correction = CORRECTIONS.has(token.lower) ||
          (token.lower === 'no' && next?.lower === 'no') ||
          (token.lower === 'no' && /^no\s+(?:set|change|make|use|put)\b/.test(text));
        return {
          tokenId: token.id,
          index: token.index,
          value: token.value,
          kind: correction ? 'correction' : 'negation',
          scopeStartToken: token.index,
          scopeEndToken: scopedVerb ? Math.min(scopedVerb.index + 3, (context.tokens.length || 1) - 1) : token.index,
          scopedVerbTokenId: scopedVerb?.tokenId || null,
          confidence: 0.78
        };
      });
    return context;
  }
}

module.exports = NegationDetector;
