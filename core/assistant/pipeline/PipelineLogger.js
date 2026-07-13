'use strict';

const { safeLogger } = require('../utils/LoggerHelpers');

class PipelineLogger {
  constructor(logger = null) {
    this.logger = safeLogger(logger);
  }

  _log(level, message, data = {}) {
    this.logger[level](`[PIPELINE] ${message}`, data);
  }

  debug(message, data) { this._log('debug', message, data); }
  info(message, data) { this._log('info', message, data); }
  warn(message, data) { this._log('warn', message, data); }
  error(message, data) { this._log('error', message, data); }

  child(scope = '') {
    const prefix = String(scope || '').trim();
    return {
      debug: (message, data) => this.debug(prefix ? `${prefix}: ${message}` : message, data),
      info: (message, data) => this.info(prefix ? `${prefix}: ${message}` : message, data),
      warn: (message, data) => this.warn(prefix ? `${prefix}: ${message}` : message, data),
      error: (message, data) => this.error(prefix ? `${prefix}: ${message}` : message, data)
    };
  }
}

module.exports = PipelineLogger;
