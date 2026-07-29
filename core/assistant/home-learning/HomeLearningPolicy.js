'use strict';

class HomeLearningPolicy {
  allowsDevice(device = {}) {
    return device.enabledForLearning !== false;
  }

  allowsEvent(event = {}) {
    if (!event.deviceId || !event.action) return { allowed: false, reason: 'invalid_event' };
    return { allowed: true };
  }
}

module.exports = HomeLearningPolicy;
