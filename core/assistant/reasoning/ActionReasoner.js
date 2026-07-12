'use strict';

const BaseReasoner = require('./BaseReasoner');

const ACTION_RULES = Object.freeze([
  { action: 'OPEN_APPLICATION', pattern: /\b(open|launch|start|run)\b/, intent: 'OpenApplication', confidence: 0.84 },
  { action: 'CLOSE_APPLICATION', pattern: /\b(close|quit|exit|stop)\b/, intent: 'CloseApplication', confidence: 0.84 },
  { action: 'SEARCH_WEB', pattern: /\b(search|google|look up)\b/, intent: 'SearchWeb', confidence: 0.82 },
  { action: 'PLAY_MEDIA', pattern: /\b(play|listen|watch|stream)\b/, intent: 'PlayMedia', confidence: 0.82 },
  { action: 'PAUSE_MEDIA', pattern: /\b(pause|resume)\b/, intent: 'PauseMedia', confidence: 0.78 },
  { action: 'SET_VOLUME', pattern: /\b(volume|mute|sound|loud|quiet)\b/, intent: 'SetVolume', confidence: 0.78 },
  { action: 'OPEN_FOLDER', pattern: /\b(open|show).*\b(folder|directory)\b/, intent: 'OpenFolder', confidence: 0.8 },
  { action: 'DELETE_FILE', pattern: /\b(delete|remove|erase)\b/, intent: 'DeleteFile', confidence: 0.8 },
  { action: 'MOVE_FILE', pattern: /\b(move|copy)\b/, intent: 'MoveFile', confidence: 0.78 },
  { action: 'CREATE_REMINDER', pattern: /\b(remind|reminder)\b/, intent: 'CreateReminder', confidence: 0.8 }
]);

class ActionReasoner extends BaseReasoner {
  reason(context) {
    const intents = new Set(context.candidateIntents.map(item => item.intent));
    for (const rule of ACTION_RULES) {
      if (!rule.pattern.test(context.normalizedInput) && !intents.has(rule.intent)) continue;
      context.addUnique('candidateActions', {
        action: rule.action,
        confidence: rule.confidence,
        evidence: [rule.intent],
        source: this.id
      });
      context.addEvidence('action', rule.action, rule.confidence, this.id);
    }
    context.diagnostics.actionCandidates = context.candidateActions.length;
    return context;
  }
}

module.exports = ActionReasoner;
