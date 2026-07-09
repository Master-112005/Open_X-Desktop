'use strict';

class LinguisticLogger {
  constructor(logger = null) {
    this.logger = logger || null;
  }

  info(message, data = {}) {
    if (typeof this.logger?.info === 'function') this.logger.info(`[Linguistic] ${message}`, data);
  }

  warn(message, data = {}) {
    if (typeof this.logger?.warn === 'function') this.logger.warn(`[Linguistic] ${message}`, data);
  }

  error(message, data = {}) {
    if (typeof this.logger?.error === 'function') this.logger.error(`[Linguistic] ${message}`, data);
  }
}

module.exports = LinguisticLogger;
