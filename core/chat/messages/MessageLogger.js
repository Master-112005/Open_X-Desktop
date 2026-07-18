const { formatLogLine } = require('../LogFormatter');

/**
 * Privacy-safe desktop message logger.
 */
class MessageLogger {
  /**
   * Creates message logger.
   * @param {object} options Logger options.
   */
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.sink = options.sink || console;
  }

  /** @param {string} message Log message. @param {object} metadata Safe metadata. */
  info(message, metadata = {}) { this.write('info', message, metadata); }

  /** @param {string} message Log message. @param {object} metadata Safe metadata. */
  warn(message, metadata = {}) { this.write('warn', message, metadata); }

  /** @param {string} message Log message. @param {object} metadata Safe metadata. */
  error(message, metadata = {}) { this.write('error', message, metadata); }

  /**
   * Writes a sanitized log record.
   * @param {string} level Level.
   * @param {string} message Message.
   * @param {object} metadata Metadata.
   */
  write(level, message, metadata = {}) {
    const writer = typeof this.sink?.[level] === 'function' ? this.sink[level] : this.sink?.log;
    if (typeof writer !== 'function') return;
    writer.call(this.sink, formatLogLine('CHAT_MESSAGE', level, message, this.redact(metadata)));
  }

  /**
   * Redacts sensitive fields recursively.
   * @param {*} value Value.
   * @returns {*} Redacted value.
   */
  redact(value) {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(item => this.redact(item));
    const output = {};
    for (const [key, child] of Object.entries(value)) {
      output[key] = /plain|content|cipher|key|secret|token/i.test(key) ? '[redacted]' : this.redact(child);
    }
    return output;
  }
}

module.exports = MessageLogger;
