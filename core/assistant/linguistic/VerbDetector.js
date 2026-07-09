'use strict';

const BaseAnalyzer = require('./BaseAnalyzer');

class VerbDetector extends BaseAnalyzer {
  analyze(context) {
    const tags = context.posTags || [];
    context.verbs = tags
      .filter(tag => ['verb', 'auxiliary', 'modal'].includes(tag.tag))
      .map(tag => ({
        tokenId: tag.tokenId,
        index: tag.index,
        value: tag.value,
        role: tag.tag === 'verb' ? 'main' : tag.tag,
        tense: /ed$/i.test(tag.value) ? 'past' : /ing$/i.test(tag.value) ? 'progressive' : 'unspecified',
        voice: 'unspecified',
        aspect: /ing$/i.test(tag.value) ? 'progressive' : 'simple',
        mood: tag.tag === 'modal' ? 'modal' : 'indicative',
        confidence: tag.confidence
      }));
    return context;
  }
}

module.exports = VerbDetector;
