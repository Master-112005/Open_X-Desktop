'use strict';

const BaseVerifier = require('./BaseVerifier');

class TransferVerifier extends BaseVerifier {
  verify(context) {
    for (const action of context.successfulActions.concat(context.failedActions)) {
      if (!/transfer|phone\.sendFile|cloud/i.test(String(action.route || action.action || ''))) continue;
      context.addEvidence('transfer', action.success ? 'transfer action reported success' : 'transfer action reported failure', {
        taskId: action.taskId,
        route: action.route
      });
    }
    return context;
  }
}

module.exports = TransferVerifier;
