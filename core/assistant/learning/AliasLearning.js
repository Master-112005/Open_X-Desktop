'use strict';

const BaseLearningModule = require('./BaseLearningModule');

class AliasLearning extends BaseLearningModule {
  learn(context) {
    const text = String(context.metadata.rawInput || '').trim();
    const match = text.match(/^(?:remember\s+)?(.+?)\s+(?:means|is\s+alias\s+for|means\s+use)\s+(.+)$/i);
    if (!match) return context;
    context.addEvent({
      category: 'alias',
      key: match[1],
      value: match[2].replace(/[.!?]+$/g, ''),
      confidence: 0.95,
      source: 'explicit-user-alias',
      module: this.id
    });
    return context;
  }
}

module.exports = AliasLearning;
