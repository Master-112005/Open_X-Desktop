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
    const type = WORKFLOW_BY_GOAL[goalId] || this._inferWorkflowType(context);
    context.workflow = {
      id: `workflow.${type}`,
      type,
      goal: goalId || null,
      tasks: context.tasks.map(task => task.id),
      workflows: [],
      actionCounts: context.actionCounts()
    };
    context.diagnostics.workflowCount = context.workflow.id ? 1 : 0;
    return context;
  }

  _inferWorkflowType(context) {
    const actions = new Set(context.tasks.map(task => task.action).filter(Boolean));
    if ([...actions].some(action => action.includes('REMINDER') || action.includes('ALARM') || action.includes('TIMER'))) return 'schedule';
    if ([...actions].some(action => action.includes('FILE') || action.includes('FOLDER'))) return 'file';
    if ([...actions].some(action => action.includes('APPLICATION'))) return 'application';
    if ([...actions].some(action => action.includes('MEDIA') || action.includes('VOLUME') || action.includes('AUDIO'))) return 'media';
    if ([...actions].some(action => action.includes('WEB') || action.includes('BROWSER'))) return 'browser';
    if ([...actions].some(action => action.includes('SYSTEM') || action.includes('SHUTDOWN') || action.includes('RESTART'))) return 'system';
    return 'general';
  }
}

module.exports = WorkflowPlanner;
