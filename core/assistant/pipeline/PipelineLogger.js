'use strict';

const { safeLogger } = require('../utils/LoggerHelpers');

class PipelineLogger {
  constructor(logger = null) {
    this.logger = safeLogger(logger);
  }

  debug(message, data) { this.logger.debug(`[PIPELINE] ${message}`, data); }
  info(message, data) { this.logger.info(`[PIPELINE] ${message}`, data); }
  warn(message, data) { this.logger.warn(`[PIPELINE] ${message}`, data); }
  error(message, data) { this.logger.error(`[PIPELINE] ${message}`, data); }
}

module.exports = PipelineLogger;
