'use strict';

class NormalizationLogger {
  constructor(logger = null) {
    this.logger = logger || null;
  }

  info(message, data = {}) {
    if (typeof this.logger?.info === 'function') this.logger.info(`[Normalization] ${message}`, data);
  }

  warn(message, data = {}) {
    if (typeof this.logger?.warn === 'function') this.logger.warn(`[Normalization] ${message}`, data);
  }

  error(message, data = {}) {
    if (typeof this.logger?.error === 'function') this.logger.error(`[Normalization] ${message}`, data);
  }
}

module.exports = NormalizationLogger;
