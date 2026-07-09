'use strict';

const BaseAnalyzer = require('./BaseAnalyzer');

class SubjectDetector extends BaseAnalyzer {
  analyze(context) {
    const tags = context.posTags || [];
    const subjects = [];
    for (const sentence of context.sentences || []) {
      const sentenceTags = tags.filter(tag => tag.index >= sentence.startToken && tag.index <= sentence.endToken);
      const firstVerb = sentenceTags.find(tag => ['verb', 'auxiliary', 'modal'].includes(tag.tag));
      const explicit = sentenceTags
        .filter(tag => firstVerb && tag.index < firstVerb.index && ['noun', 'pronoun'].includes(tag.tag))
        .slice(-1)[0];
      if (explicit) {
        subjects.push({ sentenceId: sentence.id, tokenId: explicit.tokenId, index: explicit.index, value: explicit.value, type: 'explicit', confidence: 0.72 });
      } else if (firstVerb) {
        subjects.push({ sentenceId: sentence.id, tokenId: null, index: firstVerb.index, value: 'you', type: 'implicit', confidence: 0.52 });
      }
    }
    context.subjects = subjects;
    return context;
  }
}

module.exports = SubjectDetector;
