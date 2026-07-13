'use strict';

const BaseReasoner = require('./BaseReasoner');

const CONFLICTS = Object.freeze([
  ['OPEN_APPLICATION', 'CLOSE_APPLICATION'],
  ['DELETE_FILE', 'MOVE_FILE'],
  ['SET_VOLUME', 'MUTE_AUDIO']
]);

class ConflictResolver extends BaseReasoner {
  reason(context) {
    const actions = new Set(context.candidateActions.map(item => item.action));
    for (const [left, right] of CONFLICTS) {
      if (actions.has(left) && actions.has(right)) {
        context.addConflict({
          type: 'action-conflict',
          actions: [left, right],
          confidence: 0.8,
          source: this.id
        });
      }
    }
    if (/\b(open|launch)\b.*\b(close|quit|exit)\b|\b(close|quit|exit)\b.*\b(open|launch)\b/.test(context.normalizedInput)) {
      context.addConflict({
        type: 'text-conflict',
        actions: ['OPEN_APPLICATION', 'CLOSE_APPLICATION'],
        confidence: 0.72,
        source: this.id
      });
    }
    const openCloseSameTarget = context.candidateActions.some(action => action.action === 'OPEN_APPLICATION') &&
      context.candidateActions.some(action => action.action === 'CLOSE_APPLICATION') &&
      (context.entitySummary.applications || /\bchrome|edge|notepad|browser\b/.test(context.normalizedInput));
    if (openCloseSameTarget) {
      context.addConflict({
        type: 'target-action-conflict',
        actions: ['OPEN_APPLICATION', 'CLOSE_APPLICATION'],
        confidence: 0.78,
        source: this.id
      });
    }
    context.diagnostics.conflicts = context.detectedConflicts.length;
    return context;
  }
}

module.exports = ConflictResolver;
