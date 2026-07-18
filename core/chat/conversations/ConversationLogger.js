const { formatLogLine } = require('../LogFormatter');

/**
 * Privacy-safe desktop conversation logger.
 */
class ConversationLogger {
  /**
   * Creates logger.
   * @param {object} options Logger options.
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
  }

  /**
   * Logs conversation lifecycle metadata.
   * @param {string} event Event name.
   * @param {object} metadata Non-content metadata.
   */
  info(event, metadata = {}) {
    this.write('info', event, metadata);
  }

  /**
   * Logs warning metadata.
   * @param {string} event Event name.
   * @param {object} metadata Non-content metadata.
   */
  warn(event, metadata = {}) {
    this.write('warn', event, metadata);
  }

  /**
   * Writes a sanitized log entry.
   * @param {string} level Log level.
   * @param {string} event Event name.
   * @param {object} metadata Non-content metadata.
   */
  write(level, event, metadata = {}) {
    const writer = typeof this.logger[level] === 'function' ? this.logger[level] : this.logger.log;
    writer.call(this.logger, formatLogLine('CHAT_CONVERSATION', level, event, this.sanitize(metadata)));
  }

  /**
   * Removes text-bearing fields before logging.
   * @param {object} metadata Metadata.
   * @returns {object} Sanitized metadata.
   */
  sanitize(metadata = {}) {
    const blocked = new Set(['text', 'plaintext', 'plainText', 'message', 'content', 'ciphertext', 'privateKey', 'messageKey', 'fileKey']);
    return Object.fromEntries(Object.entries(metadata).filter(([key]) => !blocked.has(key)));
  }
}

module.exports = ConversationLogger;
