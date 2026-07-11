const { deepFreeze, normalizeError } = require('../UpdateResult');

class VersionCheckResult {
  constructor({ success = true, type = 'update.versionCheck', data = {}, error = null } = {}) {
    this.success = success === true;
    this.type = String(type || 'update.versionCheck');
    this.data = JSON.parse(JSON.stringify(data || {}));
    this.error = normalizeError(error);
    this.timestamp = new Date().toISOString();
    deepFreeze(this);
  }

  static ok(type, data = {}) {
    return new VersionCheckResult({ success: true, type, data });
  }

  static fail(type, error, data = {}) {
    return new VersionCheckResult({ success: false, type, error, data });
  }
}

module.exports = VersionCheckResult;
