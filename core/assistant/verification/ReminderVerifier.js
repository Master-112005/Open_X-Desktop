'use strict';

const BaseVerifier = require('./BaseVerifier');

class ReminderVerifier extends BaseVerifier {
  verify(context) {
    for (const action of context.successfulActions.concat(context.failedActions)) {
      if (!/reminder|alarm|timer/i.test(String(action.route || action.action || ''))) continue;
      context.addEvidence('reminder', action.success ? 'schedule action reported success' : 'schedule action reported failure', {
        taskId: action.taskId,
        route: action.route
      });
    }
    return context;
  }
}

module.exports = ReminderVerifier;
