/**
 * Desktop crypto event names.
 */
module.exports = Object.freeze({
  IDENTITY_GENERATED: 'crypto.identity.generated',
  DEVICE_KEY_GENERATED: 'crypto.device.generated',
  KEY_ROTATED: 'crypto.key.rotated',
  SESSION_CREATED: 'crypto.session.created',
  SESSION_EXPIRED: 'crypto.session.expired',
  REPLAY_DETECTED: 'crypto.replay.detected',
  KEY_IMPORTED: 'crypto.key.imported',
  KEY_EXPORTED: 'crypto.key.exported',
  TRUST_CHANGED: 'crypto.trust.changed',
  STORAGE_WRITTEN: 'crypto.storage.written',
  STORAGE_READ: 'crypto.storage.read'
});
