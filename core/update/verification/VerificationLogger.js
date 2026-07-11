class VerificationLogger {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.enabled = options.enabled !== false;
  }

  info(message, details) {
    if (this.enabled) this.logger.info?.(`[VERIFY] ${message}`, details || {});
  }

  warn(message, details) {
    if (this.enabled) this.logger.warn?.(`[VERIFY] ${message}`, details || {});
  }

  error(message, details) {
    if (this.enabled) this.logger.error?.(`[VERIFY] ${message}`, details || {});
  }
}

module.exports = VerificationLogger;
