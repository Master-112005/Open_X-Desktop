class RecoveryLogger {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.enabled = options.enabled !== false;
  }

  info(message, meta = {}) {
    if (!this.enabled) return;
    this.logger.info?.(`[update-recovery] ${message}`, meta);
  }

  warn(message, meta = {}) {
    if (!this.enabled) return;
    this.logger.warn?.(`[update-recovery] ${message}`, meta);
  }

  error(message, meta = {}) {
    if (!this.enabled) return;
    this.logger.error?.(`[update-recovery] ${message}`, meta);
  }
}

module.exports = RecoveryLogger;
