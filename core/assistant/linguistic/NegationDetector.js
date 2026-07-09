'use strict';

const BaseAnalyzer = require('./BaseAnalyzer');

const NEGATIONS = new Set(['not', 'never', 'no', 'cannot', "can't", "don't", "doesn't", "didn't", "isn't", "aren't", 'without']);

class NegationDetector extends BaseAnalyzer {
  analyze(context) {
    const tags = context.posTags || [];
    context.negations = (context.tokens || [])
      .filter(token => NEGATIONS.has(token.lower) || token.lower === 'no')
      .map(token => {
        const scopedVerb = tags.find(tag => tag.index > token.index && ['verb', 'auxiliary', 'modal'].includes(tag.tag));
        return {
          tokenId: token.id,
          index: token.index,
          value: token.value,
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
