'use strict';

const BaseAnalyzer = require('./BaseAnalyzer');

class ModifierDetector extends BaseAnalyzer {
  analyze(context) {
    const tags = context.posTags || [];
    context.modifiers = tags
      .filter(tag => ['adjective', 'adverb', 'determiner'].includes(tag.tag))
      .map(tag => {
        const head = tag.tag === 'adverb'
          ? tags.find(candidate => candidate.index > tag.index && candidate.tag === 'verb')
          : tags.find(candidate => candidate.index > tag.index && candidate.tag === 'noun');
        return {
          tokenId: tag.tokenId,
          index: tag.index,
          value: tag.value,
          type: tag.tag,
          headTokenId: head?.tokenId || null,
          scope: this._clauseForIndex(context, tag.index)?.id || 'sentence',
          confidence: tag.confidence
        };
      });
    return context;
  }

  _clauseForIndex(context, index) {
    return (context.clauses || []).find(clause => index >= clause.startToken && index <= clause.endToken) || null;
  }
}

module.exports = ModifierDetector;
