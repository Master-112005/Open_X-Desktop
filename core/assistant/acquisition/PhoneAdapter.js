'use strict';

const BaseInputAdapter = require('./BaseInputAdapter');

class PhoneAdapter extends BaseInputAdapter {
  constructor(options = {}) {
    super({
      ...options,
      id: 'phone',
      source: 'phone',
      aliases: ['mobile', 'android', 'ios'],
      sourceType: 'mobile-phone',
      priority: options.priority ?? 90,
      capabilities: ['text', 'mobile-command', 'device-context']
    });
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
      sessionId: metadata.sessionId || null,
      connected: metadata.connected !== false
    };
  }
}

module.exports = PhoneAdapter;
