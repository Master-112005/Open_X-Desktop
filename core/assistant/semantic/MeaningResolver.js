'use strict';

const BaseSemanticAnalyzer = require('./BaseSemanticAnalyzer');

class MeaningResolver extends BaseSemanticAnalyzer {
  analyze(context) {
    const tokens = context.linguisticGraph?.tokens || [];
    tokens.forEach(token => {
      const match = context.dictionary.lookup(token.value)[0];
      if (!match) return;
      context.addConcept({
        concept: match.concept,
        source: 'meaning-resolver',
        tokenId: token.id,
        value: token.value,
        confidence: match.confidence,
        metadata: { dictionaryTerm: match.term, dictionarySource: match.source }
      });
    });
    return context;
  }
}

module.exports = MeaningResolver;
