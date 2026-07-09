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
          confidence: tag.confidence
        };
      });
    return context;
  }
}

module.exports = ModifierDetector;
