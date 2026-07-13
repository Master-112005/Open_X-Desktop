'use strict';

const BaseReasoner = require('./BaseReasoner');

const RULES = Object.freeze([
  { pattern: /\b(?:i'?m|i am|feel|feeling)\s+cold\b|\btoo cold\b/, inference: 'environmental-adjustment', confidence: 0.68 },
  { pattern: /\btoo loud\b|\bit'?s loud\b|\bvolume is high\b/, inference: 'audio-adjustment', confidence: 0.72 },
  { pattern: /\bfinish my assignment\b|\bwork on my assignment\b|\bneed to work\b/, inference: 'productivity-support', confidence: 0.66 },
  { pattern: /\blisten to music\b|\bplay music\b|\bsong\b/, inference: 'media-playback', confidence: 0.78 },
  { pattern: /\bsend (?:my )?(?:report|document|file)\b/, inference: 'send-document', confidence: 0.74 },
  { pattern: /\b(?:remind|reminder|notify|alert)\b/, inference: 'reminder-scheduling', confidence: 0.78 },
  { pattern: /\b(?:alarm|wake me)\b/, inference: 'alarm-scheduling', confidence: 0.78 },
  { pattern: /\b(?:timer|countdown|pomodoro)\b/, inference: 'timer-scheduling', confidence: 0.78 },
  { pattern: /\b(?:search|google|look up|what is|who is|how to)\b/, inference: 'information-request', confidence: 0.74 },
  { pattern: /\b(?:no no|actually|instead|set it to|change it to)\b/, inference: 'correction-or-revision', confidence: 0.7 },
  { pattern: /\b(?:send|share|transfer|copy|move).*\b(?:phone|mobile|laptop|computer)\b/, inference: 'device-transfer', confidence: 0.76 }
]);

class InferenceEngine extends BaseReasoner {
  reason(context) {
    for (const rule of RULES) {
      if (!rule.pattern.test(context.normalizedInput)) continue;
      context.inferences.push({ inference: rule.inference, confidence: rule.confidence, source: this.id });
      context.addEvidence('inference', rule.inference, rule.confidence, this.id);
    }
    if (context.entitySummary.media) context.addEvidence('entity.media', 'media-present', 0.76, this.id);
    if (context.entitySummary.reminders) context.addEvidence('entity.reminder', 'reminder-present', 0.78, this.id);
    if (context.entitySummary.alarms) context.addEvidence('entity.alarm', 'alarm-present', 0.78, this.id);
    if (context.entitySummary.timers) context.addEvidence('entity.timer', 'timer-present', 0.78, this.id);
    if (context.entitySummary.volumeLevels) context.addEvidence('entity.volume', 'volume-level-present', 0.78, this.id);
    if (context.entitySummary.files || context.entitySummary.folders || context.entitySummary.paths) context.addEvidence('entity.file', 'file-target-present', 0.74, this.id);
    context.diagnostics.inferenceCount = context.inferences.length;
    return context;
  }
}

module.exports = InferenceEngine;
