const { formatLogLine } = require('../LogFormatter');

/**
 * Lightweight desktop transfer logger.
 */
class TransferLogger {
  /** @param {string} message Message. @param {object} metadata Metadata. */
  info(message, metadata = {}) { this.write('info', message, metadata); }

  /** @param {string} message Message. @param {object} metadata Metadata. */
  warn(message, metadata = {}) { this.write('warn', message, metadata); }

  /** @param {string} message Message. @param {object} metadata Metadata. */
  error(message, metadata = {}) { this.write('error', message, metadata); }

  /**
   * Writes a redacted log line.
   * @param {string} level Level.
   * @param {string} message Message.
   * @param {object} metadata Metadata.
   */
  write(level, message, metadata = {}) {
    if (process.env.OPENX_CHAT_TRANSFER_LOGS !== '1') return;
    const safe = { ...metadata };
    delete safe.key;
    delete safe.fileKey;
    delete safe.plaintext;
    delete safe.encryptedBlob;
    console[level === 'error' ? 'error' : 'log'](formatLogLine('CHAT_TRANSFER', level, message, safe));
  }
}

module.exports = TransferLogger;
