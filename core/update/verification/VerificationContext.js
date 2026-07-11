class VerificationContext {
  constructor(input = {}) {
    this.filePath = input.filePath;
    this.manifest = input.manifest || {};
    this.policy = input.policy || {};
    this.currentVersion = input.currentVersion || '';
    this.configuration = input.configuration;
    this.metadata = {};
    this.file = {};
    this.hash = {};
    this.signature = {};
    this.checks = [];
    this.warnings = [];
    this.startedAt = Date.now();
  }

  addCheck(name, success, data = {}, error = null, durationMs = 0) {
    const check = Object.freeze({
      name,
      success: success === true,
      data: data && typeof data === 'object' ? { ...data } : {},
      error: error ? { code: error.code || null, message: error.message || String(error) } : null,
      durationMs: Math.max(0, Number(durationMs) || 0)
    });
    this.checks.push(check);
    return check;
  }

  warn(code, message) {
    this.warnings.push({ code, message });
  }
}

module.exports = VerificationContext;
