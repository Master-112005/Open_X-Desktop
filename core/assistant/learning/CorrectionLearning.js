'use strict';

const BaseLearningModule = require('./BaseLearningModule');

class CorrectionLearning extends BaseLearningModule {
  learn(context) {
    const text = String(context.metadata.rawInput || '').trim();
    const match = text.match(/\b(?:no|wrong|incorrect)\b.*\b(?:i\s+meant|should\s+be|make\s+it)\s+(.+)$/i);
    if (!match) return context;
    context.addEvent({
      category: 'correction',
      key: `correction:${text.toLowerCase().slice(0, 80)}`,
      value: match[1].replace(/[.!?]+$/g, '').trim(),
      confidence: 0.95,
      source: 'explicit-user-correction',
      module: this.id
    });
    return context;
  }
}

module.exports = CorrectionLearning;
