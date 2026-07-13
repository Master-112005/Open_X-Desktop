'use strict';

const LearningGuard = require('./LearningGuard');

class LearningLogger {
  constructor(logger = null) {
    this.logger = logger || null;
  }

  _safe(data) { return LearningGuard.sanitizeForLearning(data || {}); }
  _log(level, message, data) {
    const text = `[LEARNING] ${String(message || '')}`;
    this.logger?.[level]?.(text, this._safe(data));
  }
  debug(message, data) { this._log('debug', message, data); }
  info(message, data) { this._log('info', message, data); }
  warn(message, data) { this._log('warn', message, data); }
  error(message, data) { this._log('error', message, data); }
}

module.exports = LearningLogger;
