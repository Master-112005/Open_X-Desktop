'use strict';

const BaseVerifier = require('./BaseVerifier');

class BrowserVerifier extends BaseVerifier {
  verify(context) {
    for (const action of context.successfulActions.concat(context.failedActions)) {
      if (!/browser\./i.test(String(action.route || ''))) continue;
      context.addEvidence('browser', action.success ? 'browser action reported success' : 'browser action reported failure', {
        taskId: action.taskId,
        route: action.route
      });
    }
    return context;
  }
}

module.exports = BrowserVerifier;
