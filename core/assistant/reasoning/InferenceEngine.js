'use strict';

const BaseReasoner = require('./BaseReasoner');

const RULES = Object.freeze([
  { pattern: /\b(?:i'?m|i am|feel|feeling)\s+cold\b|\btoo cold\b/, inference: 'environmental-adjustment', confidence: 0.68 },
  { pattern: /\btoo loud\b|\bit'?s loud\b|\bvolume is high\b/, inference: 'audio-adjustment', confidence: 0.72 },
  { pattern: /\bfinish my assignment\b|\bwork on my assignment\b|\bneed to work\b/, inference: 'productivity-support', confidence: 0.66 },
  { pattern: /\blisten to music\b|\bplay music\b|\bsong\b/, inference: 'media-playback', confidence: 0.78 },
  { pattern: /\bsend (?:my )?(?:report|document|file)\b/, inference: 'send-document', confidence: 0.74 }
]);

class InferenceEngine extends BaseReasoner {
  reason(context) {
    for (const rule of RULES) {
      if (!rule.pattern.test(context.normalizedInput)) continue;
      context.inferences.push({ inference: rule.inference, confidence: rule.confidence, source: this.id });
      context.addEvidence('inference', rule.inference, rule.confidence, this.id);
    }
    context.diagnostics.inferenceCount = context.inferences.length;
    return context;
  }
}

module.exports = InferenceEngine;
