/**
 * Dedicated Desktop Chat device logger.
 */
class DeviceLogger {
  /**
   * Creates a device logger.
   * @param {object} options Logger options.
   */
  constructor(options = {}) {
    this.sink = options.sink || console;
  }

  /** @param {string} message Message text. @param {object} data Metadata. */
  info(message, data = {}) { this.write('info', message, data); }

  /** @param {string} message Message text. @param {object} data Metadata. */
  warn(message, data = {}) { this.write('warn', message, data); }

  /** @param {string} message Message text. @param {object} data Metadata. */
  error(message, data = {}) { this.write('error', message, data); }

  /**
   * Writes a redacted device log.
   * @param {string} level Log level.
   * @param {string} message Message.
   * @param {object} data Metadata.
   */
  write(level, message, data = {}) {
    const writer = typeof this.sink[level] === 'function' ? this.sink[level] : this.sink.log;
    writer.call(this.sink, `[CHAT_DEVICE] ${message}`, this.redact(data));
  }

  /**
   * Redacts sensitive fields.
   * @param {*} value Value.
   * @returns {*} Redacted value.
   */
  redact(value) {
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [
      key,
      /(token|secret|password|credential|key|otp|phone)/i.test(key) ? '[REDACTED]' : child
    ]));
  }
}

module.exports = DeviceLogger;
