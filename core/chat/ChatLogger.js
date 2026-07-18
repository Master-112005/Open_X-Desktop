/**
 * Dedicated Desktop Chat logger, independent from relay/cloud logging.
 */
class ChatLogger {
  /**
   * Creates a chat logger.
   * @param {object} options Logger options.
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.level = String(options.level || 'info').toLowerCase();
    this.levels = Object.freeze({ error: 0, warn: 1, info: 2, debug: 3, trace: 4 });
  }

  /** @param {string} message Message text. @param {object} data Metadata. */
  error(message, data = {}) { this.write('error', message, data); }

  /** @param {string} message Message text. @param {object} data Metadata. */
  warn(message, data = {}) { this.write('warn', message, data); }

  /** @param {string} message Message text. @param {object} data Metadata. */
  info(message, data = {}) { this.write('info', message, data); }

  /** @param {string} message Message text. @param {object} data Metadata. */
  debug(message, data = {}) { this.write('debug', message, data); }

  /** @param {string} message Message text. @param {object} data Metadata. */
  trace(message, data = {}) { this.write('trace', message, data); }

  /**
   * Writes a scoped chat log entry.
   * @param {string} level Log level.
   * @param {string} message Message text.
   * @param {object} data Metadata.
   */
  write(level, message, data = {}) {
    if (this.levels[level] > this.levels[this.level]) return;
    const writer = typeof this.logger[level] === 'function' ? this.logger[level] : this.logger.log;
    writer.call(this.logger, `[CHAT] ${message}`, this.redact(data));
  }

  /**
   * Redacts sensitive future fields.
   * @param {*} value Value to redact.
   * @param {number} depth Recursion depth.
   * @returns {*} Redacted value.
   */
  redact(value, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 4) return value;
    if (Array.isArray(value)) return value.slice(0, 20).map(item => this.redact(item, depth + 1));
    const output = {};
    for (const [key, child] of Object.entries(value)) {
      output[key] = /(token|secret|password|credential|key|otp)/i.test(key) ? '[REDACTED]' : this.redact(child, depth + 1);
    }
    return output;
  }
}

module.exports = ChatLogger;
