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
    this.logger.info?.(`[OpenXChatConversation] ${event}`, this.sanitize(metadata));
  }

  /**
   * Logs warning metadata.
   * @param {string} event Event name.
   * @param {object} metadata Non-content metadata.
   */
  warn(event, metadata = {}) {
    this.logger.warn?.(`[OpenXChatConversation] ${event}`, this.sanitize(metadata));
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
