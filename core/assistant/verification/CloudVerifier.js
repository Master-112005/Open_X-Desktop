'use strict';

const BaseVerifier = require('./BaseVerifier');

class CloudVerifier extends BaseVerifier {
  verify(context) {
    for (const action of context.successfulActions.concat(context.failedActions)) {
      if (!/cloud/i.test(String(action.route || action.action || ''))) continue;
      context.addEvidence('cloud', action.success ? 'cloud action reported success' : 'cloud action reported failure', {
        taskId: action.taskId,
        route: action.route
      });
    }
    return context;
  }
}

module.exports = CloudVerifier;
