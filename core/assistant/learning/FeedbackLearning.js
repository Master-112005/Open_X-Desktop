'use strict';

const BaseLearningModule = require('./BaseLearningModule');
const { stripLearningPunctuation } = require('./LearningLanguage');

class FeedbackLearning extends BaseLearningModule {
  learn(context) {
    const text = String(context.metadata.rawInput || '').trim();
    const normalized = text.toLowerCase();
    if (!/\b(good|wrong|do not do that|don't do that|always do this)\b/.test(normalized)) return context;
    context.addEvent({
      category: 'feedback',
      key: normalized.includes('wrong') || normalized.includes('do not') || normalized.includes("don't") ? 'negative' : 'positive',
      value: normalized.includes('always') ? 'always_do_this' : normalized.includes('wrong') ? 'wrong' : 'good',
      confidence: 0.9,
      source: 'explicit-user-feedback',
      module: this.id,
      metadata: { feedback: stripLearningPunctuation(text).slice(0, 120) }
    });
    return context;
  }
}

module.exports = FeedbackLearning;
