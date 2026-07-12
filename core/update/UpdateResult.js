function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) {
    deepFreeze(item);
  }
  return value;
}

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

class UpdateResult {
  constructor({ success = true, type = 'update.result', data = {}, error = null, timestamp = new Date().toISOString() } = {}) {
    this.success = success === true;
    this.type = String(type || 'update.result');
    this.data = clone(data) || {};
    this.error = normalizeError(error);
    this.timestamp = timestamp;
    deepFreeze(this);
  }

  static ok(type, data = {}) {
    return new UpdateResult({ success: true, type, data });
  }

  static fail(type, error, data = {}) {
    return new UpdateResult({ success: false, type, data, error });
  }
}

class InitializationResult extends UpdateResult {
  constructor(payload = {}) {
    super({ type: 'update.initialization', ...payload });
  }
}

class VersionResult extends UpdateResult {
  constructor(payload = {}) {
    super({ type: 'update.version', ...payload });
  }
}

class StatusResult extends UpdateResult {
  constructor(payload = {}) {
    super({ type: 'update.status', ...payload });
  }
}

class DiagnosticResult extends UpdateResult {
  constructor(payload = {}) {
    super({ type: 'update.diagnostics', ...payload });
  }
}

module.exports = {
  UpdateResult,
  InitializationResult,
  VersionResult,
  StatusResult,
  DiagnosticResult,
  deepFreeze,
  normalizeError
};
