'use strict';

const BaseLearningModule = require('./BaseLearningModule');
const { normalizeLearningKey } = require('./LearningLanguage');

class HabitLearning extends BaseLearningModule {
  learn(context) {
    const actions = context.assistantResponse?.verificationResult?.successfulActions || [];
    const threshold = context.configuration.habitThreshold;
    for (const action of actions) {
      const route = normalizeLearningKey(action.route || action.action || action.taskId);
      if (!route) continue;
      if (context.predictedCount('statistics', `statistic:command.${route}`, 'statistic') >= threshold) {
        context.addEvent({
          category: 'habit',
          key: `command.${route}`,
          value: route,
          confidence: 0.8,
          source: 'repeated-successful-use',
          module: this.id,
          metadata: { threshold }
        });
      }
    }
    return context;
  }
}

module.exports = HabitLearning;
