'use strict';

const BaseVerifier = require('./BaseVerifier');

class ApplicationVerifier extends BaseVerifier {
  verify(context) {
    for (const action of context.successfulActions.concat(context.failedActions)) {
      if (!/APPLICATION/.test(String(action.action || ''))) continue;
      context.addEvidence('application', action.success ? 'application action reported success' : 'application action reported failure', {
        taskId: action.taskId,
        route: action.route
      });
    }
    return context;
  }
}

module.exports = ApplicationVerifier;
