'use strict';

class NormalizationLogger {
  constructor(logger = null) {
    this.logger = logger || null;
  }

  _safeData(data = {}) {
    const payload = { ...(data || {}) };
    if (typeof payload.text === 'string' && payload.text.length > 160) payload.text = `${payload.text.slice(0, 160)}...`;
    if (typeof payload.input === 'string' && payload.input.length > 160) payload.input = `${payload.input.slice(0, 160)}...`;
    return payload;
  }

  info(message, data = {}) {
    if (typeof this.logger?.info === 'function') this.logger.info(`[Normalization] ${message}`, this._safeData(data));
  }

  warn(message, data = {}) {
    if (typeof this.logger?.warn === 'function') this.logger.warn(`[Normalization] ${message}`, this._safeData(data));
  }

  error(message, data = {}) {
    if (typeof this.logger?.error === 'function') this.logger.error(`[Normalization] ${message}`, this._safeData(data));
  }
}

module.exports = NormalizationLogger;
