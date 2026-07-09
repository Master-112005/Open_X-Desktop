'use strict';

const BasePlanner = require('./BasePlanner');

function taskId(value) {
  return String(value || 'task')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '') || 'task';
}

class TaskPlanner extends BasePlanner {
  plan(context) {
    const reasoning = context.reasoningResult || {};
    const sourceTasks = Array.isArray(reasoning.candidateTasks) && reasoning.candidateTasks.length > 0
      ? reasoning.candidateTasks
      : [];

    for (const candidate of sourceTasks) {
      context.addTask({
        id: taskId(candidate.task),
        label: candidate.task,
        metadata: { confidence: candidate.confidence, source: candidate.source }
      });
    }

    const actionCounts = {};
    for (const action of reasoning.candidateActions || []) {
      const baseId = taskId(action.action);
      actionCounts[baseId] = (actionCounts[baseId] || 0) + 1;
      context.addTask({
        id: actionCounts[baseId] > 1 ? `${baseId}.${actionCounts[baseId]}` : baseId,
        label: action.action.replace(/_/g, ' ').toLowerCase(),
        action: action.action,
        intent: reasoning.resolvedIntent?.intent || null,
        metadata: { confidence: action.confidence, source: action.source }
      });
    }

    if (context.tasks.length === 0 && reasoning.resolvedAction?.action) {
      context.addTask({
        id: taskId(reasoning.resolvedAction.action),
        label: reasoning.resolvedAction.action.replace(/_/g, ' ').toLowerCase(),
        action: reasoning.resolvedAction.action
      });
    }

    context.diagnostics.taskCount = context.tasks.length;
    return context;
  }
}

module.exports = TaskPlanner;
