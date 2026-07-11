class SelfUpdateLogger {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.enabled = options.enabled !== false;
  }

  info(message, meta = {}) {
    if (!this.enabled) return;
    this.logger.info?.(`[self-update] ${message}`, meta);
  }

  warn(message, meta = {}) {
    if (!this.enabled) return;
    this.logger.warn?.(`[self-update] ${message}`, meta);
  }

  error(message, meta = {}) {
    if (!this.enabled) return;
    this.logger.error?.(`[self-update] ${message}`, meta);
  }
}

module.exports = SelfUpdateLogger;
