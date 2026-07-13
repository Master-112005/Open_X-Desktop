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
        lemma: tag.lemma || String(tag.value || '').toLowerCase(),
        role: tag.tag === 'verb' ? 'main' : tag.tag,
        clauseId: this._clauseForIndex(context, tag.index)?.id || null,
        polarity: this._hasNegationBefore(context, tag.index) ? 'negative' : 'positive',
        tense: /ed$/i.test(tag.value) ? 'past' : /ing$/i.test(tag.value) ? 'progressive' : 'unspecified',
        voice: 'unspecified',
        aspect: /ing$/i.test(tag.value) ? 'progressive' : 'simple',
        mood: tag.tag === 'modal' ? 'modal' : 'indicative',
        confidence: tag.confidence
      }));
    return context;
  }

  _clauseForIndex(context, index) {
    return (context.clauses || []).find(clause => index >= clause.startToken && index <= clause.endToken) || null;
  }

  _hasNegationBefore(context, index) {
    return (context.tokens || []).slice(Math.max(0, index - 3), index)
      .some(token => /^(?:not|never|no|cannot|can't|don't|doesn't|didn't|isn't|aren't)$/i.test(token.value));
  }
}

module.exports = VerbDetector;
