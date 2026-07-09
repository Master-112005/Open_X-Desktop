'use strict';

const BaseInputAdapter = require('./BaseInputAdapter');

class PhoneAdapter extends BaseInputAdapter {
  constructor(options = {}) {
    super({ ...options, id: 'phone', source: 'phone', sourceType: 'mobile-phone', priority: options.priority ?? 90 });
  }

  acquire(payload = {}) {
    const input = super.acquire(payload);
    return input;
  }

  normalizeMetadata(metadata = {}) {
    return {
      ...metadata,
      deviceType: metadata.deviceType || 'phone',
      phoneDeviceId: metadata.deviceId || metadata.phoneDeviceId || null,
      sessionId: metadata.sessionId || null
    };
  }
}

module.exports = PhoneAdapter;
