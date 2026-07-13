'use strict';

const BaseVerifier = require('./BaseVerifier');

class ReminderVerifier extends BaseVerifier {
  verify(context) {
    for (const action of this.completedAndFailed(context)) {
      if (!/reminder|alarm|timer/i.test(String(action.route || action.action || ''))) continue;
      this.addActionEvidence(context, 'schedule', action, 'schedule action reported success', 'schedule action reported failure');
    }
    return context;
  }
}

module.exports = ReminderVerifier;
