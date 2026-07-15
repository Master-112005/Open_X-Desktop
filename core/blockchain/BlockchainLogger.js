'use strict';

const SENSITIVE_PATTERN = /(?:private|secret|seed|mnemonic|password|token|credential|authorization|api[_-]?key)/i;

class BlockchainLogger {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.level = options.level || 'info';
    this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
    this.context = { scope: 'blockchain', ...(options.context || {}) };
  }

  child(context = {}) {
    return new BlockchainLogger({
      logger: this.logger,
      level: this.level,
      context: { ...this.context, ...context }
    });
  }

  error(message, data, correlationId) {
    this.write('error', message, data, correlationId);
  }

  warn(message, data, correlationId) {
    this.write('warn', message, data, correlationId);
  }

  info(message, data, correlationId) {
    this.write('info', message, data, correlationId);
  }

  debug(message, data, correlationId) {
    this.write('debug', message, data, correlationId);
  }

  write(level, message, data = {}, correlationId = '') {
    if (this.levels[level] > this.levels[this.level]) return;
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      context: { ...this.context, correlationId: correlationId || undefined },
      message,
      data: this.redact(data)
    };
    try {
      if (typeof this.logger[level] === 'function') {
        this.logger[level]('[BLOCKCHAIN] ' + message, entry);
      }
    } catch (_) {}
  }

  redact(value, depth = 0) {
    if (value === null || value === undefined) return value;
    if (depth > 5) return '[MaxDepth]';
    if (Array.isArray(value)) return value.slice(0, 25).map(item => this.redact(item, depth + 1));
    if (typeof value !== 'object') return value;
    const output = {};
    for (const [key, child] of Object.entries(value)) {
      output[key] = SENSITIVE_PATTERN.test(key) ? '[REDACTED]' : this.redact(child, depth + 1);
    }
    return output;
  }
}

module.exports = BlockchainLogger;
