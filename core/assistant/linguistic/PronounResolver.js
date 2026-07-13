'use strict';

const BaseAnalyzer = require('./BaseAnalyzer');

const PRONOUNS = new Set(['he', 'him', 'she', 'her', 'it', 'they', 'them', 'this', 'that', 'these', 'those', 'same', 'one', 'ones', 'there']);

class PronounResolver extends BaseAnalyzer {
  analyze(context) {
    const tags = context.posTags || [];
    const pronouns = [];
    for (const sentence of context.sentences || []) {
      const sentenceTags = tags.filter(tag => tag.index >= sentence.startToken && tag.index <= sentence.endToken);
      sentenceTags.forEach(tag => {
        if (tag.tag !== 'pronoun' || !PRONOUNS.has(String(tag.value).toLowerCase())) return;
        const priorNouns = sentenceTags.filter(candidate => candidate.index < tag.index && candidate.tag === 'noun');
        const lower = String(tag.value || '').toLowerCase();
        const antecedent = ['he', 'him', 'she', 'her', 'they', 'them'].includes(lower)
          ? priorNouns[0]
          : priorNouns[priorNouns.length - 1];
        pronouns.push({
          tokenId: tag.tokenId,
          index: tag.index,
          value: tag.value,
          kind: this._kind(lower),
          antecedentTokenId: antecedent?.tokenId || null,
          antecedent: antecedent?.value || null,
          scope: 'sentence',
          confidence: antecedent ? 0.55 : 0.2
        });
      });
    }
    context.pronouns = pronouns;
    return context;
  }

  _kind(value) {
    if (['this', 'that', 'these', 'those', 'there'].includes(value)) return 'demonstrative';
    if (['same', 'one', 'ones'].includes(value)) return 'reference';
    return 'personal';
  }
}

module.exports = PronounResolver;
