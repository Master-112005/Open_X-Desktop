class DownloadLogger {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.enabled = options.enabled !== false;
  }

  info(message, details) {
    if (this.enabled) this.logger.info?.(`[DOWNLOAD] ${message}`, details || {});
  }

  warn(message, details) {
    if (this.enabled) this.logger.warn?.(`[DOWNLOAD] ${message}`, details || {});
  }

  error(message, details) {
    if (this.enabled) this.logger.error?.(`[DOWNLOAD] ${message}`, details || {});
  }
}

module.exports = DownloadLogger;
