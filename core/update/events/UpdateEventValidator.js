const FORBIDDEN_FIELDS = new Set([
  'downloadUrl',
  'downloadURL',
  'installerUrl',
  'installerURL',
  'sha256',
  'checksum',
  'installerName',
  'installerType',
  'assets',
  'releaseAssets'
]);

class UpdateEventValidator {
  constructor(options = {}) {
    this.versionManager = options.versionManager;
  }

  validate(event = {}) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      return this.fail('INVALID_EVENT', 'Update notification must be an object.');
    }
    for (const key of Object.keys(event)) {
      if (FORBIDDEN_FIELDS.has(key)) {
        return this.fail('FORBIDDEN_UPDATE_FIELD', `Update notification must not include ${key}.`);
      }
    }
    if (event.type !== 'update:available') return this.fail('INVALID_TYPE', 'Invalid update notification type.');
    if (event.protocolVersion !== '1') return this.fail('INVALID_PROTOCOL', 'Unsupported update notification protocol.');
    if (!String(event.eventId || '').trim()) return this.fail('MISSING_EVENT_ID', 'Update notification eventId is required.');
    if (!Number.isFinite(Date.parse(event.timestamp))) return this.fail('INVALID_TIMESTAMP', 'Update notification timestamp is invalid.');
    if (!this.isValidVersion(event.latestVersion)) return this.fail('INVALID_LATEST_VERSION', 'Invalid latest version.');
    if (event.minimumVersion && !this.isValidVersion(event.minimumVersion)) {
      return this.fail('INVALID_MINIMUM_VERSION', 'Invalid minimum version.');
    }
    return { success: true, event: Object.freeze({ ...event }) };
  }

  isValidVersion(version) {
    if (this.versionManager?.isValidVersion) return this.versionManager.isValidVersion(version);
    return /^v?\d+\.\d+\.\d+/.test(String(version || ''));
  }

  fail(code, message) {
    return { success: false, error: { code, message } };
  }
}

module.exports = UpdateEventValidator;
