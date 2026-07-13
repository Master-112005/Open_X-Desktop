'use strict';

const BaseLearningModule = require('./BaseLearningModule');
const { normalizeLearningKey } = require('./LearningLanguage');

class ConversationLearning extends BaseLearningModule {
  learn(context) {
    const responseType = context.assistantResponse?.responseType || '';
    const source = normalizeLearningKey(context.metadata.source || 'chat') || 'chat';
    if (!responseType) return context;
    context.addEvent({
      category: 'conversation',
      key: `style.${source}.${responseType}`,
      value: responseType,
      confidence: 0.75,
      source: 'response-metadata',
      module: this.id,
      metadata: { responseType }
    });
    return context;
  }
}

module.exports = ConversationLearning;
