class UpdatePresentationLogger {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.enabled = options.enabled !== false;
  }

  info(message, details) {
    if (this.enabled) this.logger.info?.(`[UPDATE_UI] ${message}`, details || {});
  }

  warn(message, details) {
    if (this.enabled) this.logger.warn?.(`[UPDATE_UI] ${message}`, details || {});
  }

  error(message, details) {
    if (this.enabled) this.logger.error?.(`[UPDATE_UI] ${message}`, details || {});
  }
}

module.exports = UpdatePresentationLogger;
