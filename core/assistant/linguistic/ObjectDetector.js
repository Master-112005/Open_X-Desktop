'use strict';

const BaseAnalyzer = require('./BaseAnalyzer');

class ObjectDetector extends BaseAnalyzer {
  analyze(context) {
    const tags = context.posTags || [];
    const objects = [];
    for (const verb of context.verbs || []) {
      const after = tags.filter(tag => tag.index > verb.index);
      const direct = after.find(tag => ['noun', 'pronoun', 'numeral', 'quote'].includes(tag.tag));
      if (direct) {
        objects.push({
          verbTokenId: verb.tokenId,
          tokenId: direct.tokenId,
          index: direct.index,
          value: direct.value,
          type: 'direct',
          confidence: 0.64
        });
      }
      after.forEach((tag, offset) => {
        if (tag.tag !== 'preposition') return;
        const prepObject = after.slice(offset + 1).find(candidate => ['noun', 'pronoun', 'numeral'].includes(candidate.tag));
        if (prepObject) {
          objects.push({
            verbTokenId: verb.tokenId,
            prepositionTokenId: tag.tokenId,
            tokenId: prepObject.tokenId,
            index: prepObject.index,
            value: prepObject.value,
            type: 'prepositional',
            preposition: tag.value,
            confidence: 0.58
          });
        }
      });
    }
    context.objects = objects;
    return context;
  }
}

module.exports = ObjectDetector;
