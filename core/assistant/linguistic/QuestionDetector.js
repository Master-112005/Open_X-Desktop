'use strict';

const BaseAnalyzer = require('./BaseAnalyzer');

const WH_WORDS = new Set(['what', 'who', 'when', 'where', 'why', 'how', 'which', 'whom', 'whose']);
const AUXILIARY_STARTERS = new Set(['am', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'can', 'could', 'will', 'would', 'should', 'may', 'might']);

class QuestionDetector extends BaseAnalyzer {
  analyze(context) {
    context.questions = (context.sentences || []).map(sentence => {
      const sentenceTokens = context.tokens.slice(sentence.startToken, sentence.endToken + 1);
      const firstWord = sentenceTokens.find(token => token.type === 'word')?.lower || '';
      const hasQuestionMark = sentenceTokens.some(token => token.value === '?');
      let type = 'none';
      if (WH_WORDS.has(firstWord)) type = 'wh';
      else if (AUXILIARY_STARTERS.has(firstWord)) type = 'yes-no';
      else if (hasQuestionMark) type = 'question';
      else if (/^(?:tell|show|explain|define)\s+(?:me\s+)?(?:what|who|when|where|why|how|which)\b/i.test(sentence.text)) type = 'embedded-wh';
      else if (/\b(?:do|does|did|can|could|will|would|should)\s+you\s+(?:know|think|tell|show)\b/i.test(sentence.text)) type = 'assistant-question';
      const tagQuestion = /,\s*(isn't|is it|right|okay|ok)\??$/i.test(sentence.text);
      if (tagQuestion) type = 'tag';
      return {
        sentenceId: sentence.id,
        type,
        isQuestion: type !== 'none',
        hasQuestionMark,
        confidence: type === 'none' ? 0.6 : 0.82
      };
    }).filter(item => item.isQuestion);
    return context;
  }
}

module.exports = QuestionDetector;
