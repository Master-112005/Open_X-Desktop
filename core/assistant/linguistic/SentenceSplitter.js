'use strict';

const BaseAnalyzer = require('./BaseAnalyzer');

class SentenceSplitter extends BaseAnalyzer {
  analyze(context) {
    const tokens = context.tokens || [];
    if (tokens.length === 0) {
      context.sentences = [];
      return context;
    }
    const sentences = [];
    let startToken = 0;
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      const isBoundary = token.type === 'sentence-punctuation' || index === tokens.length - 1;
      if (!isBoundary) continue;
      const endToken = index;
      const sentenceTokens = tokens.slice(startToken, endToken + 1);
      if (sentenceTokens.length > 0) {
        sentences.push({
          id: `sent_${sentences.length}`,
          index: sentences.length,
          startToken,
          endToken,
          start: sentenceTokens[0].start,
          end: sentenceTokens[sentenceTokens.length - 1].end,
          text: context.normalizedSentence.slice(sentenceTokens[0].start, sentenceTokens[sentenceTokens.length - 1].end).trim(),
          tokenCount: sentenceTokens.length,
          kind: sentenceTokens.some(item => item.value === '?') ? 'question' : 'statement'
        });
      }
      startToken = index + 1;
    }
    context.sentences = sentences.length > 0 ? sentences : [{
      id: 'sent_0',
      index: 0,
      startToken: 0,
      endToken: Math.max(0, tokens.length - 1),
      start: 0,
      end: context.normalizedSentence.length,
      text: context.normalizedSentence,
      tokenCount: tokens.length,
      kind: /\?\s*$/.test(context.normalizedSentence) ? 'question' : 'statement'
    }];
    return context;
  }
}

module.exports = SentenceSplitter;
