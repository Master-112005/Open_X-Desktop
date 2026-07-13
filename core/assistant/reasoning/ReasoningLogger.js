'use strict';

class ReasoningLogger {
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

  debug(message, data) { this.logger?.debug?.(message, this._safeData(data)); }
  info(message, data) { this.logger?.info?.(message, this._safeData(data)); }
  warn(message, data) { this.logger?.warn?.(message, this._safeData(data)); }
  error(message, data) { this.logger?.error?.(message, this._safeData(data)); }
}

module.exports = ReasoningLogger;
