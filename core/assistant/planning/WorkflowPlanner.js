'use strict';

const BasePlanner = require('./BasePlanner');

const WORKFLOW_BY_GOAL = Object.freeze({
  'media.playback': 'media',
  'send.document': 'email',
  productivity: 'productivity',
  'application.control': 'application',
  'web.search': 'browser',
  'file.management': 'file',
  'reminder.management': 'reminder',
  'audio.adjustment': 'media'
});

class WorkflowPlanner extends BasePlanner {
  plan(context) {
    const goalId = context.reasoningResult?.resolvedGoal?.id || '';
    const type = WORKFLOW_BY_GOAL[goalId] || 'general';
    context.workflow = {
      id: `workflow.${type}`,
      type,
      goal: goalId || null,
      tasks: context.tasks.map(task => task.id),
      workflows: []
    };
    context.diagnostics.workflowCount = context.workflow.id ? 1 : 0;
    return context;
  }
}

module.exports = WorkflowPlanner;
