'use strict';

const BaseReasoner = require('./BaseReasoner');

const GOAL_TO_INTENTS = Object.freeze({
  'media.playback': ['PlayMedia', 'OpenMediaPlatform'],
  'send.document': ['SendDocument', 'ShareFile'],
  'device.transfer': ['TransferFile', 'ShareFile'],
  productivity: ['OpenApplication', 'OpenFolder'],
  'application.control': ['OpenApplication', 'CloseApplication', 'SwitchApplication'],
  'web.search': ['SearchWeb', 'OpenWebsite'],
  'file.management': ['OpenFile', 'MoveFile', 'DeleteFile', 'OpenFolder'],
  'reminder.management': ['CreateReminder', 'ShowReminders', 'CancelReminder'],
  'alarm.management': ['SetAlarm', 'ShowAlarms', 'CancelAlarm'],
  'timer.management': ['SetTimer', 'ShowTimers', 'CancelTimer'],
  'audio.adjustment': ['SetVolume', 'MuteAudio'],
  'display.adjustment': ['SetBrightness']
});

class IntentReasoner extends BaseReasoner {
  reason(context) {
    for (const goal of context.candidateGoals) {
      const intents = GOAL_TO_INTENTS[goal.id] || [];
      for (const intent of intents) {
        context.addUnique('candidateIntents', {
          intent,
          confidence: Number((goal.confidence * this._intentWeight(intent, context)).toFixed(3)),
          evidence: [goal.id],
          source: this.id
        });
      }
    }
    context.diagnostics.intentCandidates = context.candidateIntents.length;
    return context;
  }

  _intentWeight(intent, context) {
    if (/^(SetAlarm|SetTimer|CreateReminder)$/.test(intent) && (context.entitySummary.times || context.entitySummary.durations || context.entitySummary.dates)) return 0.94;
    if (intent === 'PlayMedia' && context.entitySummary.media) return 0.94;
    if (intent === 'SetVolume' && context.entitySummary.volumeLevels) return 0.95;
    if (intent === 'SetBrightness' && context.entitySummary.brightnessLevels) return 0.95;
    return 0.9;
  }
}

module.exports = IntentReasoner;
