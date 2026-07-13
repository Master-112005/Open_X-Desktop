'use strict';

const BaseVerifier = require('./BaseVerifier');

class WindowVerifier extends BaseVerifier {
  verify(context) {
    for (const action of this.completedAndFailed(context)) {
      if (!/WINDOW/.test(String(action.action || '')) && !/window\./i.test(String(action.route || ''))) continue;
      this.addActionEvidence(context, 'window', action, 'window action reported success', 'window action reported failure');
    }
    return context;
  }
}

module.exports = WindowVerifier;
