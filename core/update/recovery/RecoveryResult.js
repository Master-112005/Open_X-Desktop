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

class RecoveryResult {
  constructor({ success = true, type = 'recovery.result', data = {}, error = null, timestamp = new Date().toISOString() } = {}) {
    this.success = success === true;
    this.type = String(type || 'recovery.result');
    this.data = clone(data) || {};
    this.error = normalizeError(error);
    this.timestamp = timestamp;
    Object.freeze(this);
  }

  static ok(type, data = {}) {
    return new RecoveryResult({ success: true, type, data });
  }

  static fail(type, error, data = {}) {
    return new RecoveryResult({ success: false, type, error, data });
  }
}

module.exports = RecoveryResult;
