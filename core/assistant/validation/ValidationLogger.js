'use strict';

class ValidationLogger {
  constructor(logger = null) {
    this.logger = logger || null;
  }

  _safe(data) {
    if (!data || typeof data !== 'object') return data;
    const copy = { ...data };
    for (const key of Object.keys(copy)) {
      if (/(password|token|secret|key|email|phone|messageText)/i.test(key)) copy[key] = '[REDACTED]';
    }
    return copy;
  }

  debug(message, data) { this.logger?.debug?.(`[Validation] ${message}`, this._safe(data)); }
  info(message, data) { this.logger?.info?.(`[Validation] ${message}`, this._safe(data)); }
  warn(message, data) { this.logger?.warn?.(`[Validation] ${message}`, this._safe(data)); }
  error(message, data) { this.logger?.error?.(`[Validation] ${message}`, this._safe(data)); }
}

module.exports = ValidationLogger;
