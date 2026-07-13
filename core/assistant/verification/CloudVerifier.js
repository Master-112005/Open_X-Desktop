'use strict';

const BaseVerifier = require('./BaseVerifier');

class CloudVerifier extends BaseVerifier {
  verify(context) {
    for (const action of this.completedAndFailed(context)) {
      if (!/cloud/i.test(String(action.route || action.action || ''))) continue;
      this.addActionEvidence(context, 'cloud', action, 'cloud action reported success', 'cloud action reported failure');
    }
    return context;
  }
}

module.exports = CloudVerifier;
