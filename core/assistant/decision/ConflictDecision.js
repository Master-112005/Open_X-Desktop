'use strict';

const BaseDecision = require('./BaseDecision');

class ConflictDecision extends BaseDecision {
  decide(context) {
    const actions = new Set((context.executionBlueprint?.tasks || []).map(task => task.action).filter(Boolean));
    const conflicts = [
      ['OPEN_APPLICATION', 'CLOSE_APPLICATION'],
      ['SET_VOLUME', 'MUTE_AUDIO']
    ];
    for (const [left, right] of conflicts) {
      if (actions.has(left) && actions.has(right)) {
        context.conflicts.push({ type: 'action-conflict', actions: [left, right] });
      }
    }
    if (context.conflicts.length > 0) {
      context.setStatus('CLARIFY', 'execution conflict requires clarification');
    }
    return context;
  }
}

module.exports = ConflictDecision;
