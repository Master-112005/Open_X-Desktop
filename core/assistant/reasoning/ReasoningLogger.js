'use strict';

class ReasoningLogger {
  constructor(logger = null) {
    this.logger = logger || null;
  }

  _safeData(data, depth = 0) {
    if (!data || typeof data !== 'object') return data;
    if (depth > 3) return '[Object]';
    if (Array.isArray(data)) return data.slice(0, 30).map(item => this._safeData(item, depth + 1));
    const copy = {};
    for (const [key, value] of Object.entries(data)) {
      copy[key] = /(password|token|secret|private|key|email|phone|otp|pin|session)/i.test(key)
        ? '[REDACTED]'
        : this._safeData(value, depth + 1);
    }
    return copy;
  }

  debug(message, data) { this.logger?.debug?.(message, this._safeData(data)); }
  info(message, data) { this.logger?.info?.(message, this._safeData(data)); }
  warn(message, data) { this.logger?.warn?.(message, this._safeData(data)); }
  error(message, data) { this.logger?.error?.(message, this._safeData(data)); }
}

module.exports = ReasoningLogger;
