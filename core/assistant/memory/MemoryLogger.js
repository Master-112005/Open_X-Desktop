'use strict';

const { sanitizeDetails } = require('../utils/ErrorHelpers');

class MemoryLogger {
  constructor(logger = null) {
    this.logger = logger || null;
  }

  _log(level, message, data = {}) {
    this.logger?.[level]?.(`[MEMORY] ${message}`, sanitizeDetails(data));
  }

  debug(message, data) { this._log('debug', message, data); }
  info(message, data) { this._log('info', message, data); }
  warn(message, data) { this._log('warn', message, data); }
  error(message, data) { this._log('error', message, data); }
}

module.exports = MemoryLogger;
