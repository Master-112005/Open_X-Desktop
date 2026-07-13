'use strict';

const BaseVerifier = require('./BaseVerifier');

class ApplicationVerifier extends BaseVerifier {
  verify(context) {
    for (const action of this.completedAndFailed(context)) {
      if (!/APPLICATION/.test(String(action.action || '')) && !/app\./i.test(String(action.route || ''))) continue;
      this.addActionEvidence(context, 'application', action, 'application action reported success', 'application action reported failure', {
        expectedRoute: action.route || null
      });
    }
    return context;
  }
}

module.exports = ApplicationVerifier;
