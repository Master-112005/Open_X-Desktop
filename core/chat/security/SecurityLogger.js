/**
 * Privacy-safe Desktop Chat security logger.
 */
class SecurityLogger {
  /** @param {string} message Message. @param {object} metadata Metadata. */
  info(message, metadata = {}) { this.write('info', message, metadata); }

  /** @param {string} message Message. @param {object} metadata Metadata. */
  warn(message, metadata = {}) { this.write('warn', message, metadata); }

  /** @param {string} message Message. @param {object} metadata Metadata. */
  error(message, metadata = {}) { this.write('error', message, metadata); }

  /**
   * Writes a sanitized security log.
   * @param {string} level Level.
   * @param {string} message Message.
   * @param {object} metadata Metadata.
   */
  write(level, message, metadata = {}) {
    if (process.env.OPENX_CHAT_SECURITY_DEBUG !== '1') return;
    const safe = Object.fromEntries(Object.entries(metadata).filter(([key]) => !/pin|otp|secret|private|token|key/i.test(key)));
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`[OpenXChatSecurity] ${message}`, safe);
  }
}

module.exports = SecurityLogger;
