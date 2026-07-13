'use strict';

const { safeLogger } = require('../utils/LoggerHelpers');

class ResponseLogger {
  constructor(logger = null) {
    this.logger = safeLogger(logger);
  }

  debug(message, data) { this.logger.debug(message, data); }
  info(message, data) { this.logger.info(message, data); }
  warn(message, data) { this.logger.warn(message, data); }
  error(message, data) { this.logger.error(message, data); }
}

module.exports = ResponseLogger;
