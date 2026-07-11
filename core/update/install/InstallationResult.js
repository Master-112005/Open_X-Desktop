function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function normalizeError(error) {
  if (!error) return null;
  return Object.freeze({
    name: String(error.name || 'Error'),
    message: String(error.message || error),
    code: error.code || null
  });
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

class InstallationResult {
  constructor({ success = true, type = 'installation.result', data = {}, error = null, timestamp = new Date().toISOString() } = {}) {
    this.success = success === true;
    this.type = String(type || 'installation.result');
    this.data = clone(data) || {};
    this.error = normalizeError(error);
    this.timestamp = timestamp;
    deepFreeze(this);
  }

  static ok(type, data = {}) {
    return new InstallationResult({ success: true, type, data });
  }

  static fail(type, error, data = {}) {
    return new InstallationResult({ success: false, type, error, data });
  }
}

module.exports = InstallationResult;
