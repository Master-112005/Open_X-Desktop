'use strict';

const BaseLearningModule = require('./BaseLearningModule');
const { extractReplacement, stripLearningPunctuation } = require('./LearningLanguage');

class FeedbackLearning extends BaseLearningModule {
  learn(context) {
    const text = String(context.metadata.rawInput || '').trim();
    const normalized = text.toLowerCase();
    if (!/\b(good|wrong|do not do that|don't do that|always do this)\b/.test(normalized)) return context;
    const negative = normalized.includes('wrong') || normalized.includes('do not') || normalized.includes("don't");
    const correctionCandidate = negative ? extractReplacement(text) : '';
    context.addEvent({
      category: 'feedback',
      key: negative ? 'negative' : 'positive',
      value: normalized.includes('always') ? 'always_do_this' : normalized.includes('wrong') ? 'wrong' : 'good',
      confidence: 0.9,
      source: 'explicit-user-feedback',
      module: this.id,
      metadata: {
        feedback: stripLearningPunctuation(text).slice(0, 120),
        correctionCandidate: correctionCandidate ? stripLearningPunctuation(correctionCandidate).slice(0, 120) : null
      }
    });
    return context;
  }
}

module.exports = FeedbackLearning;
