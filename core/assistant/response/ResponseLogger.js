'use strict';

const { safeLogger } = require('../utils/LoggerHelpers');
const { sanitizeDetails } = require('../utils/ErrorHelpers');

class ResponseLogger {
  constructor(logger = null) {
    this.logger = safeLogger(logger);
  }

  safeData(data) { return sanitizeDetails(data || {}); }
  debug(message, data) { this.logger.debug(message, this.safeData(data)); }
  info(message, data) { this.logger.info(message, this.safeData(data)); }
  warn(message, data) { this.logger.warn(message, this.safeData(data)); }
  error(message, data) { this.logger.error(message, this.safeData(data)); }
}

module.exports = ResponseLogger;
