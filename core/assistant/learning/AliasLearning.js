'use strict';

const BaseLearningModule = require('./BaseLearningModule');
const { stripLearningPunctuation } = require('./LearningLanguage');

class AliasLearning extends BaseLearningModule {
  learn(context) {
    const text = String(context.metadata.rawInput || '').trim();
    const match = text.match(/^(?:remember\s+)?(.+?)\s+(?:means|is\s+alias\s+for|means\s+use)\s+(.+)$/i);
    if (!match) return context;
    context.addEvent({
      category: 'alias',
      key: stripLearningPunctuation(match[1]),
      value: stripLearningPunctuation(match[2]),
      confidence: 0.95,
      source: 'explicit-user-alias',
      module: this.id,
      metadata: { directive: 'alias' }
    });
    return context;
  }
}

module.exports = AliasLearning;
