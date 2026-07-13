'use strict';

const BasePlanner = require('./BasePlanner');

const ACTION_LABELS = Object.freeze({
  OPEN_APPLICATION: 'open application',
  CLOSE_APPLICATION: 'close application',
  SEARCH_WEB: 'search web',
  PLAY_MEDIA: 'play media',
  PAUSE_MEDIA: 'pause media',
  RESUME_MEDIA: 'resume media',
  STOP_MEDIA: 'stop media',
  SET_VOLUME: 'set volume',
  MUTE_AUDIO: 'mute audio',
  OPEN_FOLDER: 'open folder',
  OPEN_FILE: 'open file',
  CREATE_FILE: 'create file',
  DELETE_FILE: 'delete file',
  MOVE_FILE: 'move file',
  CREATE_REMINDER: 'create reminder'
});

class TaskPlanner extends BasePlanner {
  plan(context) {
    const reasoning = context.reasoningResult || {};
    const inheritedEntities = {
      ...(reasoning.metadata?.entities || {}),
      ...(context.metadata?.entities || {})
    };
    const sourceTasks = Array.isArray(reasoning.candidateTasks) && reasoning.candidateTasks.length > 0
      ? reasoning.candidateTasks
      : [];

    for (const candidate of sourceTasks) {
      context.addTask({
        id: this.taskId(candidate.task),
        label: candidate.task,
        action: candidate.action || null,
        intent: candidate.intent || reasoning.resolvedIntent?.intent || null,
        optional: candidate.optional === true,
        repeatable: candidate.repeatable === true,
        retryable: candidate.retryable !== false,
        cancelable: candidate.cancelable !== false,
        metadata: {
          ...(candidate.metadata || {}),
          confidence: candidate.confidence,
          source: candidate.source,
          entities: { ...inheritedEntities, ...(candidate.metadata?.entities || {}) }
        }
      });
    }

    for (const action of reasoning.candidateActions || []) {
      context.addTask({
        id: this.taskId(action.taskId || action.action),
        label: action.label || ACTION_LABELS[action.action] || String(action.action || '').replace(/_/g, ' ').toLowerCase(),
        action: action.action,
        intent: reasoning.resolvedIntent?.intent || null,
        optional: action.optional === true,
        repeatable: action.repeatable === true,
        retryable: action.retryable !== false,
        cancelable: action.cancelable !== false,
        metadata: {
          ...(action.metadata || {}),
          confidence: action.confidence,
          source: action.source,
          evidence: Array.isArray(action.evidence) ? action.evidence.slice() : [],
          automationAction: action.automationAction || action.metadata?.automationAction,
          entities: { ...inheritedEntities, ...(action.metadata?.entities || {}) }
        },
        dependsOn: action.dependsOn || action.metadata?.dependsOn || []
      });
    }

    if (context.tasks.length === 0 && reasoning.resolvedAction?.action) {
      const action = reasoning.resolvedAction;
      context.addTask({
        id: this.taskId(action.action),
        label: action.label || ACTION_LABELS[action.action] || action.action.replace(/_/g, ' ').toLowerCase(),
        action: action.action,
        intent: reasoning.resolvedIntent?.intent || null,
        metadata: {
          ...(action.metadata || {}),
          confidence: action.confidence,
          source: action.source,
          entities: { ...inheritedEntities, ...(action.metadata?.entities || {}) }
        }
      });
    }

    if (Array.isArray(reasoning.clarificationRequirements) && reasoning.clarificationRequirements.length > 0) {
      context.metadata.clarificationRequirements = reasoning.clarificationRequirements.slice();
    }

    context.diagnostics.taskCount = context.tasks.length;
    return context;
  }
}

module.exports = TaskPlanner;
