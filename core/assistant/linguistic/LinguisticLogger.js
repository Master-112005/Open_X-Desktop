'use strict';

class LinguisticLogger {
  constructor(logger = null) {
    this.logger = logger || null;
  }

  _safeData(data) {
    if (!data || typeof data !== 'object') return data;
    const copy = { ...data };
    for (const key of Object.keys(copy)) {
      if (/(password|token|secret|key|email|phone)/i.test(key)) copy[key] = '[REDACTED]';
    }
    return copy;
  }

  info(message, data = {}) {
    if (typeof this.logger?.info === 'function') this.logger.info(`[Linguistic] ${message}`, this._safeData(data));
  }

  warn(message, data = {}) {
    if (typeof this.logger?.warn === 'function') this.logger.warn(`[Linguistic] ${message}`, this._safeData(data));
  }

  error(message, data = {}) {
    if (typeof this.logger?.error === 'function') this.logger.error(`[Linguistic] ${message}`, this._safeData(data));
  }
}

module.exports = LinguisticLogger;
