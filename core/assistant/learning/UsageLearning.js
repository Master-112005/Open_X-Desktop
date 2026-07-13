'use strict';

const BaseLearningModule = require('./BaseLearningModule');
const { normalizeLearningKey } = require('./LearningLanguage');

class UsageLearning extends BaseLearningModule {
  learn(context) {
    const actions = context.assistantResponse?.verificationResult?.successfulActions || [];
    for (const action of actions) {
      const route = normalizeLearningKey(action.route || action.action || action.taskId);
      if (!route) continue;
      context.addEvent({
        category: 'statistic',
        key: `command.${route}`,
        value: route,
        confidence: 1,
        source: 'successful-action',
        module: this.id,
        metadata: { successful: true }
      });
    }
    return context;
  }
}

module.exports = UsageLearning;
