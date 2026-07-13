'use strict';

const BaseLearningModule = require('./BaseLearningModule');
const { normalizeLearningKey } = require('./LearningLanguage');

class PatternLearning extends BaseLearningModule {
  learn(context) {
    const actions = context.assistantResponse?.verificationResult?.successfulActions || [];
    for (const action of actions) {
      const route = normalizeLearningKey(action.route || action.action || action.taskId);
      if (!route) continue;
      if (context.storage.getCount('statistics', `statistic:command.${route}`) + 1 >= context.configuration.patternThreshold) {
        context.addEvent({
          category: 'pattern',
          key: `frequent.command.${route}`,
          value: route,
          confidence: 0.8,
          source: 'long-term-usage',
          module: this.id,
          metadata: { threshold: context.configuration.patternThreshold }
        });
      }
    }
    return context;
  }
}

module.exports = PatternLearning;
