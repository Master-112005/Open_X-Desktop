'use strict';

const BaseLearningModule = require('./BaseLearningModule');

class HabitLearning extends BaseLearningModule {
  learn(context) {
    const actions = context.assistantResponse?.verificationResult?.successfulActions || [];
    const threshold = context.configuration.habitThreshold;
    for (const action of actions) {
      const route = action.route || action.action || action.taskId;
      if (!route) continue;
      if (context.storage.getCount('statistics', `statistic:command.${route}`) + 1 >= threshold) {
        context.addEvent({
          category: 'habit',
          key: `command.${route}`,
          value: route,
          confidence: 0.8,
          source: 'repeated-successful-use',
          module: this.id
        });
      }
    }
    return context;
  }
}

module.exports = HabitLearning;
