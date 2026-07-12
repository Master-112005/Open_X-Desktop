'use strict';

const BaseReasoner = require('./BaseReasoner');

const GOAL_TO_INTENTS = Object.freeze({
  'media.playback': ['PlayMedia', 'OpenMediaPlatform'],
  'send.document': ['SendDocument', 'ShareFile'],
  productivity: ['OpenApplication', 'OpenFolder'],
  'application.control': ['OpenApplication', 'CloseApplication', 'SwitchApplication'],
  'web.search': ['SearchWeb', 'OpenWebsite'],
  'file.management': ['OpenFile', 'MoveFile', 'DeleteFile', 'OpenFolder'],
  'reminder.management': ['CreateReminder', 'SetAlarm', 'SetTimer'],
  'audio.adjustment': ['SetVolume', 'MuteAudio']
});

class IntentReasoner extends BaseReasoner {
  reason(context) {
    for (const goal of context.candidateGoals) {
      const intents = GOAL_TO_INTENTS[goal.id] || [];
      for (const intent of intents) {
        context.addUnique('candidateIntents', {
          intent,
          confidence: Number((goal.confidence * 0.9).toFixed(3)),
          evidence: [goal.id],
          source: this.id
        });
      }
    }
    context.diagnostics.intentCandidates = context.candidateIntents.length;
    return context;
  }
}

module.exports = IntentReasoner;
