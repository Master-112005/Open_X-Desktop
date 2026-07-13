'use strict';

const BaseReasoner = require('./BaseReasoner');

class ClarificationEngine extends BaseReasoner {
  reason(context) {
    const text = context.normalizedInput;
    const hasBrowser = Boolean(context.resolvedContext?.browserState?.currentBrowser || context.resolvedContext?.workingMemory?.currentBrowser);
    const hasFile = Boolean(context.resolvedContext?.workingMemory?.currentFile || context.evidence.some(item => item.type === 'context.selection'));
    if (/\bopen browser\b/.test(text) && !hasBrowser) {
      this._missing(context, 'browser', 'target-browser', 0.7);
    }
    if (/\bplay music\b/.test(text) && !/\b(?:spotify|youtube|apple music|song|track)\b/.test(text)) {
      this._missing(context, 'media-platform', 'target-media-platform', 0.64);
    }
    if (/\b(?:move|delete|send)\s+(?:it|that|file|report)\b/.test(text) && !hasFile) {
      this._missing(context, 'file', 'target-file', 0.72);
    }
    if (context.candidateActions.some(action => action.action === 'PLAY_MEDIA') && !context.entitySummary.media && !/\b(?:music|song|playlist)\b/.test(text)) {
      this._missing(context, 'media-query', 'target-media', 0.64);
    }
    if (context.candidateActions.some(action => action.action === 'CREATE_REMINDER') && !context.entitySummary.reminders) {
      this._missing(context, 'reminderText', 'reminder-content', 0.68);
    }
    if (context.candidateActions.some(action => action.action === 'SET_TIMER') && !context.entitySummary.durations) {
      this._missing(context, 'duration', 'timer-duration', 0.68);
    }
    if (context.candidateActions.some(action => action.action === 'SET_ALARM') && !context.entitySummary.times) {
      this._missing(context, 'timeExpression', 'alarm-time', 0.68);
    }
    context.diagnostics.clarifications = context.clarificationRequirements.length;
    return context;
  }

  _missing(context, field, requirement, confidence) {
    context.addMissing({ field, confidence, source: this.id });
    context.addClarification({ requirement, field, confidence, source: this.id });
  }
}

module.exports = ClarificationEngine;
