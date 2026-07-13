'use strict';

const BaseVerifier = require('./BaseVerifier');

class BrowserVerifier extends BaseVerifier {
  verify(context) {
    for (const action of this.completedAndFailed(context)) {
      if (!/browser\./i.test(String(action.route || ''))) continue;
      this.addActionEvidence(context, 'browser', action, 'browser action reported success', 'browser action reported failure');
    }
    return context;
  }
}

module.exports = BrowserVerifier;
