'use strict';

const BaseLearningModule = require('./BaseLearningModule');
const { stripLearningPunctuation, normalizeLearningKey } = require('./LearningLanguage');

class CorrectionLearning extends BaseLearningModule {
  learn(context) {
    const text = String(context.metadata.rawInput || '').trim();
    const match = text.match(/\b(?:no|wrong|incorrect)\b.*\b(?:i\s+meant|should\s+be|make\s+it)\s+(.+)$/i);
    if (!match) return context;
    context.addEvent({
      category: 'correction',
      key: `correction:${normalizeLearningKey(text).slice(0, 80)}`,
      value: stripLearningPunctuation(match[1]),
      confidence: 0.95,
      source: 'explicit-user-correction',
      module: this.id,
      metadata: { directive: 'correction' }
    });
    return context;
  }
}

module.exports = CorrectionLearning;
