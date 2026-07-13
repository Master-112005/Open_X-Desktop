'use strict';

const BaseAnalyzer = require('./BaseAnalyzer');

class ObjectDetector extends BaseAnalyzer {
  analyze(context) {
    const tags = context.posTags || [];
    const objects = [];
    for (const verb of context.verbs || []) {
      const clause = this._clauseForIndex(context, verb.index);
      const after = tags.filter(tag => tag.index > verb.index && (!clause || tag.index <= clause.endToken));
      const direct = this._findDirectObjectPhrase(context, after);
      if (direct) {
        objects.push({
          verbTokenId: verb.tokenId,
          clauseId: clause?.id || null,
          tokenId: direct.head.tokenId,
          index: direct.head.index,
          startToken: direct.startToken,
          endToken: direct.endToken,
          value: direct.text,
          headValue: direct.head.value,
          type: 'direct',
          confidence: direct.text === direct.head.value ? 0.64 : 0.72
        });
      }
      after.forEach((tag, offset) => {
        if (tag.tag !== 'preposition') return;
        const prepObject = after.slice(offset + 1).find(candidate => ['noun', 'pronoun', 'numeral'].includes(candidate.tag));
        if (prepObject) {
          objects.push({
            verbTokenId: verb.tokenId,
            clauseId: clause?.id || null,
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

  _findDirectObjectPhrase(context, afterTags) {
    const contentTags = afterTags.filter(tag => !['punctuation', 'preposition'].includes(tag.tag));
    const head = contentTags.find(tag => ['noun', 'pronoun', 'numeral', 'quote'].includes(tag.tag));
    if (!head) return null;
    const source = context.posTags || [];
    let start = head.index;
    let end = head.index;
    for (let index = head.index - 1; index >= 0; index -= 1) {
      const tag = source.find(item => item.index === index);
      if (!tag || !['adjective', 'determiner', 'noun', 'numeral'].includes(tag.tag)) break;
      start = index;
    }
    for (let index = head.index + 1; index < source.length; index += 1) {
      const tag = source.find(item => item.index === index);
      if (!tag) break;
      if (['noun', 'adjective', 'determiner', 'numeral', 'quote'].includes(tag.tag)) {
        end = index;
        continue;
      }
      if (tag.tag === 'conjunction') {
        const next = source.find(item => item.index === index + 1);
        if (next && ['noun', 'adjective', 'numeral', 'quote'].includes(next.tag)) {
          end = index;
          continue;
        }
      }
      break;
    }
    return {
      head,
      startToken: start,
      endToken: end,
      text: this.spanText(context, start, end)
    };
  }

  _clauseForIndex(context, index) {
    return (context.clauses || []).find(clause => index >= clause.startToken && index <= clause.endToken) || null;
  }
}

module.exports = ObjectDetector;
