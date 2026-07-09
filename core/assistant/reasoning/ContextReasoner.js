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
    return context;
  }
}

module.exports = ContextReasoner;
