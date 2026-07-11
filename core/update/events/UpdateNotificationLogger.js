class UpdateNotificationLogger {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.enabled = options.enabled !== false;
  }

  info(message, details) {
    if (this.enabled) this.logger.info?.(`[UPDATE_NOTIFICATION] ${message}`, details || {});
  }

  warn(message, details) {
    if (this.enabled) this.logger.warn?.(`[UPDATE_NOTIFICATION] ${message}`, details || {});
  }

  error(message, details) {
    if (this.enabled) this.logger.error?.(`[UPDATE_NOTIFICATION] ${message}`, details || {});
  }
}

module.exports = UpdateNotificationLogger;
