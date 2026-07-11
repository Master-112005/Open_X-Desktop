class InstallationLogger {
  constructor(options = {}) {
    this.logger = options.logger || null;
    this.enabled = options.enabled !== false;
  }

  info(message, metadata = {}) {
    if (this.enabled && this.logger?.info) this.logger.info(`[Install] ${message}`, metadata);
  }

  warn(message, metadata = {}) {
    if (this.enabled && this.logger?.warn) this.logger.warn(`[Install] ${message}`, metadata);
  }

  error(message, metadata = {}) {
    if (this.enabled && this.logger?.error) this.logger.error(`[Install] ${message}`, metadata);
  }
}

module.exports = InstallationLogger;
