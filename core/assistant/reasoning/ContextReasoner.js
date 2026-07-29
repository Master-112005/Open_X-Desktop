'use strict';

const BaseReasoner = require('./BaseReasoner');

class ContextReasoner extends BaseReasoner {
  reason(context) {
    const resolved = context.resolvedContext || {};
    if (resolved.application?.focusedApplication) {
      context.addEvidence('context.application', resolved.application.focusedApplication, 0.62, this.id);
    }
    if (resolved.browserState?.currentBrowser) {
      context.addEvidence('context.browser', resolved.browserState.currentBrowser, 0.62, this.id);
    }
    if (resolved.selections?.selectedText || resolved.selections?.selectedFiles?.length) {
      context.addEvidence('context.selection', 'selection-present', 0.66, this.id);
    }
    for (const reference of resolved.resolvedReferences || []) {
      context.addEvidence('context.reference', reference.target, reference.confidence || 0.6, this.id);
    }
    const recent = resolved.workingMemory?.lastAction || resolved.conversationMemory?.lastAction || resolved.metadata?.lastAction || null;
    if (recent) context.addEvidence('context.recent-action', String(recent), 0.66, this.id);
    if (/\b(?:it|that|them|this|same|again)\b/.test(context.normalizedInput)) {
      context.addEvidence('context.follow-up', 'reference-dependent-command', 0.68, this.id);
    }
    if (
      /\b(?:next|previous|prev|back|forward|pause|resume|play|stop)\b/.test(context.normalizedInput) &&
      (resolved.media?.active || resolved.application?.focusedApplication || resolved.browserState?.currentBrowser || recent)
    ) {
      context.addEvidence('context.active-surface', 'active-control-target', 0.7, this.id);
    }
    if (/\b(?:no no|actually|instead|set it to|change it to)\b/.test(context.normalizedInput)) {
      context.metadata.isCorrection = true;
      context.addEvidence('context.correction', 'correction-or-revision', 0.72, this.id);
      const value = context.entitySummary.volumeLevels || /\bvol(?:ume)?\b/.test(context.normalizedInput);
      if (value) {
        context.addUnique('candidateGoals', { id: 'audio.adjustment', name: 'Audio Adjustment', confidence: 0.78, evidence: ['context.correction'], source: this.id });
        context.addUnique('candidateIntents', { intent: 'SetVolume', confidence: 0.76, evidence: ['audio.adjustment'], source: this.id });
        context.addUnique('candidateActions', { action: 'SET_VOLUME', confidence: 0.78, evidence: ['SetVolume'], source: this.id });
      }
    }
    return context;
  }
}

module.exports = ContextReasoner;
