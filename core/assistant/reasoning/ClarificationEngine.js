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
    context.diagnostics.clarifications = context.clarificationRequirements.length;
    return context;
  }

  _missing(context, field, requirement, confidence) {
    context.missingInformation.push({ field, confidence, source: this.id });
    context.clarificationRequirements.push({ requirement, field, confidence, source: this.id });
  }
}

module.exports = ClarificationEngine;
