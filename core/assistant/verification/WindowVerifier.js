'use strict';

const BaseVerifier = require('./BaseVerifier');

class WindowVerifier extends BaseVerifier {
  verify(context) {
    for (const action of context.successfulActions.concat(context.failedActions)) {
      if (!/WINDOW/.test(String(action.action || '')) && !/window\./i.test(String(action.route || ''))) continue;
      context.addEvidence('window', action.success ? 'window action reported success' : 'window action reported failure', {
        taskId: action.taskId,
        route: action.route
      });
    }
    return context;
  }
}

module.exports = WindowVerifier;
