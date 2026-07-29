'use strict';

class HomeEventValidator {
  validate(event = {}) {
    if (!event.deviceId || !event.action || !event.timestamp) {
      return { valid: false, reason: 'Home event requires deviceId, action, and timestamp.' };
    }
    if (String(event.deviceId).length > 120 || String(event.action).length > 80) {
      return { valid: false, reason: 'Home event identifiers are too long.' };
    }
    if (Number.isNaN(Date.parse(event.timestamp))) {
      return { valid: false, reason: 'Home event timestamp is invalid.' };
    }
    return { valid: true, event };
  }
}

module.exports = HomeEventValidator;
