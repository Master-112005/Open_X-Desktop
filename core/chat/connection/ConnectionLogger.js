/**
 * Desktop connection logger that avoids sensitive values.
 */
class ConnectionLogger {
  /** @param {object} options Logger options. */
  constructor(options = {}) {
    this.level = options.level || 'info';
  }

  /** @param {string} message Message. @param {object} metadata Metadata. */
  info(message, metadata = {}) { this.write('info', message, metadata); }

  /** @param {string} message Message. @param {object} metadata Metadata. */
  warn(message, metadata = {}) { this.write('warn', message, metadata); }

  /** @param {string} level Level. @param {string} message Message. @param {object} metadata Metadata. */
  write(level, message, metadata = {}) {
    if (this.level === 'silent') return;
    const safe = Object.fromEntries(Object.entries(metadata).map(([key, value]) => [
      key,
      /token|plaintext|privateKey|sessionKey|messageText/i.test(key) ? '[redacted]' : value
    ]));
    console[level === 'warn' ? 'warn' : 'log'](`[OpenXChatConnection] ${message}`, safe);
  }
}

module.exports = ConnectionLogger;
