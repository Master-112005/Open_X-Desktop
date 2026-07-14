'use strict';

const BaseLearningModule = require('./BaseLearningModule');
const { extractReplacement, stripLearningPunctuation, normalizeLearningKey } = require('./LearningLanguage');

const CORRECTION_PREFIX_PATTERN = /^(?:no|nope|nah|wrong|incorrect|actually|instead)\b/i;
const ACTION_REPAIR_PATTERN = /\b(?:i\s+meant|should\s+be|make\s+it|set\s+it\s+to|change\s+it\s+to|do|run|execute|perform|use|open|close|search|find|play|set|turn|start|launch|show|list|send|call)\b.+$/i;

class CorrectionLearning extends BaseLearningModule {
  learn(context) {
    const text = String(context.metadata.rawInput || '').trim();
    const explicit = text.match(/\b(?:no|wrong|incorrect)\b.*\b(?:i\s+meant|should\s+be|make\s+it|set\s+it\s+to|change\s+it\s+to)\s+(.+)$/i);
    const replacement = explicit?.[1]
      ? explicit[1]
      : CORRECTION_PREFIX_PATTERN.test(text) && ACTION_REPAIR_PATTERN.test(text)
        ? extractReplacement(text)
        : '';
    if (!replacement) return context;
    context.addEvent({
      category: 'correction',
      key: `correction:${normalizeLearningKey(text).slice(0, 80)}`,
      value: stripLearningPunctuation(replacement),
      confidence: 0.95,
      source: 'explicit-user-correction',
      module: this.id,
      metadata: { directive: 'correction' }
    });
    return context;
  }
}

module.exports = CorrectionLearning;
