'use strict';

const BaseLearningModule = require('./BaseLearningModule');
const { normalizeLearningKey, stripLearningPunctuation } = require('./LearningLanguage');

class PreferenceLearning extends BaseLearningModule {
  learn(context) {
    const text = String(context.metadata.rawInput || '').trim();
    const direct = text.match(/\bpreferred\s+(browser|editor|music\s+player|email\s+client|file\s+manager)\s+(?:is|=)\s+(.+)$/i);
    const reverse = text.match(/\bprefer\s+(.+?)\s+(?:for|as)\s+(browser|editor|music\s+player|email\s+client|file\s+manager)\b/i);
    const kind = direct?.[1] || reverse?.[2];
    const value = direct?.[2] || reverse?.[1];
    if (!kind || !value) return context;
    context.addEvent({
      category: 'preference',
      key: normalizeLearningKey(kind),
      value: stripLearningPunctuation(value),
      confidence: 0.95,
      source: 'explicit-user-preference',
      module: this.id,
      metadata: { directive: 'preference' }
    });
    return context;
  }
}

module.exports = PreferenceLearning;
