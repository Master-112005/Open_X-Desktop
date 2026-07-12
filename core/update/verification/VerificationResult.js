function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

class VerificationResult {
  constructor({
    success = true,
    status = 'PASSED',
    verificationId = '',
    checks = [],
    errors = [],
    warnings = [],
    securityLevel = 'verified',
    data = {},
    durationMs = 0,
    timestamp = new Date().toISOString()
  } = {}) {
    this.success = success === true;
    this.status = String(status || (this.success ? 'PASSED' : 'FAILED'));
    this.verificationId = String(verificationId || '');
    this.checks = checks.map(check => Object.freeze({ ...check }));
    this.errors = errors.map(error => Object.freeze({
      code: error.code || null,
      message: error.message || String(error)
    }));
    this.warnings = warnings.map(warning => Object.freeze({
      code: warning.code || null,
      message: warning.message || String(warning)
    }));
    this.securityLevel = String(securityLevel || 'unknown');
    this.data = data && typeof data === 'object' ? { ...data } : {};
    this.durationMs = Math.max(0, Number(durationMs) || 0);
    this.timestamp = timestamp;
    deepFreeze(this);
  }

  static passed(payload = {}) {
    return new VerificationResult({ success: true, status: 'PASSED', ...payload });
  }

  static failed(error, payload = {}) {
    const errors = payload.errors || [];
    return new VerificationResult({
      success: false,
      status: 'FAILED',
      ...payload,
      errors: error ? [error, ...errors] : errors
    });
  }
}

module.exports = VerificationResult;
