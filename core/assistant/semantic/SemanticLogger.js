'use strict';

class SemanticLogger {
  constructor(logger = null) {
    this.logger = logger || null;
  }

  info(message, data = {}) {
    if (typeof this.logger?.info === 'function') this.logger.info(`[Semantic] ${message}`, data);
  }

  warn(message, data = {}) {
    if (typeof this.logger?.warn === 'function') this.logger.warn(`[Semantic] ${message}`, data);
  }

  error(message, data = {}) {
    if (typeof this.logger?.error === 'function') this.logger.error(`[Semantic] ${message}`, data);
  }
}

module.exports = SemanticLogger;
