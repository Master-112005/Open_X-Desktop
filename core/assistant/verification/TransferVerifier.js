'use strict';

const BaseVerifier = require('./BaseVerifier');

class TransferVerifier extends BaseVerifier {
  verify(context) {
    for (const action of this.completedAndFailed(context)) {
      if (!/transfer|phone\.sendFile|cloud/i.test(String(action.route || action.action || ''))) continue;
      this.addActionEvidence(context, 'transfer', action, 'transfer action reported success', 'transfer action reported failure');
    }
    return context;
  }
}

module.exports = TransferVerifier;
