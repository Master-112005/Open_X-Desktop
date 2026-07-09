'use strict';

const BaseReasoner = require('./BaseReasoner');

const GOAL_RULES = Object.freeze([
  { id: 'media.playback', name: 'Media Playback', pattern: /\b(?:play|listen|music|song|video|watch)\b/, inference: 'media-playback', confidence: 0.8 },
  { id: 'send.document', name: 'Send Document', pattern: /\b(?:send|share|transfer).*\b(?:report|document|file|pdf)\b/, inference: 'send-document', confidence: 0.78 },
  { id: 'productivity', name: 'Productivity', pattern: /\b(?:work|assignment|project|study|productivity)\b/, inference: 'productivity-support', confidence: 0.66 },
  { id: 'application.control', name: 'Application Control', pattern: /\b(?:open|launch|start|close|quit|switch)\b/, confidence: 0.76 },
  { id: 'web.search', name: 'Web Search', pattern: /\b(?:search|google|look up|find information)\b/, confidence: 0.76 },
  { id: 'file.management', name: 'File Management', pattern: /\b(?:file|folder|directory|move|delete|copy|rename)\b/, confidence: 0.72 },
  { id: 'reminder.management', name: 'Reminder Management', pattern: /\b(?:remind|reminder|alarm|timer)\b/, confidence: 0.74 },
  { id: 'audio.adjustment', name: 'Audio Adjustment', pattern: /\b(?:volume|mute|loud|quiet|sound)\b/, inference: 'audio-adjustment', confidence: 0.72 }
]);

class GoalReasoner extends BaseReasoner {
  reason(context) {
    const inferences = new Set(context.inferences.map(item => item.inference));
    for (const rule of GOAL_RULES) {
      const matched = rule.pattern.test(context.normalizedInput) || (rule.inference && inferences.has(rule.inference));
      if (!matched) continue;
      context.addUnique('candidateGoals', {
        id: rule.id,
        name: rule.name,
        confidence: rule.confidence,
        evidence: [rule.inference || 'input-pattern'],
        source: this.id
      });
      context.addEvidence('goal', rule.id, rule.confidence, this.id);
    }
    context.diagnostics.goalCandidates = context.candidateGoals.length;
    return context;
  }
}

module.exports = GoalReasoner;
