'use strict';

const BaseReasoner = require('./BaseReasoner');

const GOAL_RULES = Object.freeze([
  { id: 'media.playback', name: 'Media Playback', pattern: /\b(?:play|listen|music|song|video|watch)\b/, inference: 'media-playback', confidence: 0.8 },
  { id: 'send.document', name: 'Send Document', pattern: /\b(?:send|share|transfer).*\b(?:report|document|file|pdf)\b/, inference: 'send-document', confidence: 0.78 },
  { id: 'device.transfer', name: 'Device Transfer', pattern: /\b(?:send|share|transfer|copy|move).*\b(?:phone|mobile|laptop|computer)\b/, inference: 'device-transfer', confidence: 0.78 },
  { id: 'productivity', name: 'Productivity', pattern: /\b(?:work|assignment|project|study|productivity)\b/, inference: 'productivity-support', confidence: 0.66 },
  { id: 'application.control', name: 'Application Control', pattern: /\b(?:open|launch|start|close|quit|switch)\b/, confidence: 0.76 },
  { id: 'web.search', name: 'Web Search', pattern: /\b(?:search|google|look up|find information)\b/, confidence: 0.76 },
  { id: 'file.management', name: 'File Management', pattern: /\b(?:file|folder|directory|move|delete|copy|rename)\b/, confidence: 0.72 },
  { id: 'reminder.management', name: 'Reminder Management', pattern: /\b(?:remind|reminder|notify|alert)\b/, inference: 'reminder-scheduling', confidence: 0.78 },
  { id: 'alarm.management', name: 'Alarm Management', pattern: /\b(?:alarm|wake me)\b/, inference: 'alarm-scheduling', confidence: 0.78 },
  { id: 'timer.management', name: 'Timer Management', pattern: /\b(?:timer|countdown|pomodoro)\b/, inference: 'timer-scheduling', confidence: 0.78 },
  { id: 'audio.adjustment', name: 'Audio Adjustment', pattern: /\b(?:volume|vol|mute|loud|quiet|sound|set it to)\b/, inference: 'audio-adjustment', confidence: 0.72 },
  { id: 'display.adjustment', name: 'Display Adjustment', pattern: /\b(?:brightness|screen|display|dim|brighter)\b/, confidence: 0.72 }
]);

class GoalReasoner extends BaseReasoner {
  reason(context) {
    const inferences = new Set(context.inferences.map(item => item.inference));
    for (const rule of GOAL_RULES) {
      const matched = rule.pattern.test(context.normalizedInput) || (rule.inference && inferences.has(rule.inference));
      if (!matched) continue;
      const entityBoost = this._entityBoost(context, rule.id);
      context.addUnique('candidateGoals', {
        id: rule.id,
        name: rule.name,
        confidence: Math.min(1, Number((rule.confidence + entityBoost).toFixed(3))),
        evidence: [rule.inference || 'input-pattern'],
        source: this.id
      });
      context.addEvidence('goal', rule.id, rule.confidence, this.id);
    }
    context.diagnostics.goalCandidates = context.candidateGoals.length;
    return context;
  }

  _entityBoost(context, goalId) {
    if (goalId === 'media.playback' && context.entitySummary.media) return context.configuration?.entityBoost || 0.08;
    if ((goalId === 'reminder.management' && context.entitySummary.reminders) ||
      (goalId === 'alarm.management' && context.entitySummary.alarms) ||
      (goalId === 'timer.management' && context.entitySummary.timers)) return context.configuration?.entityBoost || 0.08;
    if (goalId === 'file.management' && (context.entitySummary.files || context.entitySummary.folders || context.entitySummary.paths)) return context.configuration?.entityBoost || 0.08;
    if (goalId === 'audio.adjustment' && context.entitySummary.volumeLevels) return context.configuration?.entityBoost || 0.08;
    if (goalId === 'display.adjustment' && context.entitySummary.brightnessLevels) return context.configuration?.entityBoost || 0.08;
    return 0;
  }
}

module.exports = GoalReasoner;
