'use strict';

const BaseLearningModule = require('./BaseLearningModule');

class WorkflowLearning extends BaseLearningModule {
  learn(context) {
    const actions = context.assistantResponse?.verificationResult?.successfulActions || [];
    if (actions.length < 2) return context;
    const sequence = actions.map(action => action.route || action.action || action.taskId).filter(Boolean);
    if (sequence.length < 2) return context;
    const key = `workflow.${sequence.join('>')}`;
    if (context.storage.getCount('workflows', `workflow:${key}`) + 1 >= context.configuration.workflowThreshold) {
      context.addEvent({
        category: 'workflow',
        key,
        value: sequence.join(' > '),
        confidence: 0.8,
        source: 'repeated-successful-sequence',
        module: this.id
      });
    }
    return context;
  }
}

module.exports = WorkflowLearning;
