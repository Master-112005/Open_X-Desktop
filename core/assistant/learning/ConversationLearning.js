'use strict';

const BaseLearningModule = require('./BaseLearningModule');

class ConversationLearning extends BaseLearningModule {
  learn(context) {
    const responseType = context.assistantResponse?.responseType || '';
    const source = context.metadata.source || 'chat';
    if (!responseType) return context;
    context.addEvent({
      category: 'conversation',
      key: `style.${source}.${responseType}`,
      value: responseType,
      confidence: 0.75,
      source: 'response-metadata',
      module: this.id
    });
    return context;
  }
}

module.exports = ConversationLearning;
