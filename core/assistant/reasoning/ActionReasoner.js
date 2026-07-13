'use strict';

const BaseReasoner = require('./BaseReasoner');

const ACTION_RULES = Object.freeze([
  { action: 'OPEN_APPLICATION', pattern: /\b(open|launch|start|run)\b/, intent: 'OpenApplication', confidence: 0.84 },
  { action: 'CLOSE_APPLICATION', pattern: /\b(close|quit|exit|stop)\b/, intent: 'CloseApplication', confidence: 0.84 },
  { action: 'SEARCH_WEB', pattern: /\b(search|google|look up|what is|who is|how to)\b/, intent: 'SearchWeb', confidence: 0.82 },
  { action: 'PLAY_MEDIA', pattern: /\b(play|listen|watch|stream|music|song)\b/, intent: 'PlayMedia', confidence: 0.82 },
  { action: 'PAUSE_MEDIA', pattern: /\bpause\b/, intent: 'PauseMedia', confidence: 0.78 },
  { action: 'RESUME_MEDIA', pattern: /\bresume\b/, intent: 'ResumeMedia', confidence: 0.78 },
  { action: 'SET_VOLUME', pattern: /\b(volume|vol|sound|loud|quiet|set it to)\b/, intent: 'SetVolume', confidence: 0.8 },
  { action: 'MUTE_AUDIO', pattern: /\bmute\b/, intent: 'MuteAudio', confidence: 0.8 },
  { action: 'SET_BRIGHTNESS', pattern: /\b(brightness|screen|display|dim|brighter)\b/, intent: 'SetBrightness', confidence: 0.78 },
  { action: 'OPEN_FOLDER', pattern: /\b(open|show).*\b(folder|directory)\b/, intent: 'OpenFolder', confidence: 0.8 },
  { action: 'OPEN_FILE', pattern: /\b(open|show).*\b(file|document|pdf)\b/, intent: 'OpenFile', confidence: 0.78 },
  { action: 'DELETE_FILE', pattern: /\b(delete|remove|erase)\b/, intent: 'DeleteFile', confidence: 0.8 },
  { action: 'MOVE_FILE', pattern: /\b(move|copy)\b/, intent: 'MoveFile', confidence: 0.78 },
  { action: 'TRANSFER_FILE', pattern: /\b(send|share|transfer).*\b(phone|mobile|laptop|computer)\b/, intent: 'TransferFile', confidence: 0.8 },
  { action: 'CREATE_REMINDER', pattern: /\b(remind|reminder|notify|alert)\b/, intent: 'CreateReminder', confidence: 0.82 },
  { action: 'SET_ALARM', pattern: /\b(alarm|wake me)\b/, intent: 'SetAlarm', confidence: 0.82 },
  { action: 'SET_TIMER', pattern: /\b(timer|countdown|pomodoro)\b/, intent: 'SetTimer', confidence: 0.82 }
]);

class ActionReasoner extends BaseReasoner {
  reason(context) {
    const intents = new Set(context.candidateIntents.map(item => item.intent));
    for (const rule of ACTION_RULES) {
      const patternMatched = rule.pattern.test(context.normalizedInput);
      const correctionMatched = context.metadata.isCorrection === true && rule.action === 'SET_VOLUME' && intents.has(rule.intent);
      if (!patternMatched && !correctionMatched) continue;
      const metadata = this._metadataForAction(context, rule.action);
      context.addUnique('candidateActions', {
        action: rule.action,
        confidence: Math.min(1, Number((rule.confidence + (metadata.entityBacked ? (context.configuration?.entityBoost || 0.08) : 0)).toFixed(3))),
        evidence: [rule.intent],
        source: this.id,
        metadata
      });
      context.addEvidence('action', rule.action, rule.confidence, this.id);
    }
    context.diagnostics.actionCandidates = context.candidateActions.length;
    return context;
  }

  _metadataForAction(context, action) {
    const entities = {};
    const add = (name, value) => { if (value !== null && value !== undefined && value !== '') entities[name] = value; };
    add('mediaQuery', this.entityValue(context, 'media'));
    add('appName', this.entityValue(context, 'applications'));
    add('browserName', this.entityValue(context, 'browsers'));
    add('filename', this.entityValue(context, 'files'));
    add('folderName', this.entityValue(context, 'folders'));
    add('path', this.entityValue(context, 'paths'));
    add('contactName', this.entityValue(context, 'contacts'));
    add('reminderText', this.entityValue(context, 'reminders'));
    add('alarmLabel', this.entityValue(context, 'alarms'));
    add('timerLabel', this.entityValue(context, 'timers'));
    add('timeExpression', this.entityValue(context, 'times') || this.entityValue(context, 'dates'));
    add('duration', this.entityValue(context, 'durations'));
    add('value', this.entityValue(context, action === 'SET_BRIGHTNESS' ? 'brightnessLevels' : 'volumeLevels'));
    return {
      entities,
      entityBacked: Object.keys(entities).length > 0,
      actionFamily: String(action || '').split('_')[0].toLowerCase()
    };
  }
}

module.exports = ActionReasoner;
