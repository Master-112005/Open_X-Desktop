const crypto = require('crypto');
const { MESSAGE_STATUS, MESSAGE_TYPE } = require('./MessageConstants');

/**
 * Desktop local encrypted message record factory.
 */
class MessageModel {
  /**
   * Creates a local message record.
   * @param {object} input Message input.
   * @returns {object} Message record.
   */
  static create(input = {}) {
    const now = new Date(input.now || Date.now()).toISOString();
    return {
      messageId: input.messageId || MessageModel.messageId(),
      relationshipId: input.relationshipId,
      senderAccountId: input.senderAccountId,
      senderDeviceId: input.senderDeviceId,
      recipientAccountId: input.recipientAccountId,
      recipientDeviceId: input.recipientDeviceId,
      messageType: input.messageType || MESSAGE_TYPE.TEXT,
      ciphertext: input.ciphertext,
      metadata: input.metadata || {},
      timestamp: input.timestamp || now,
      sequence: Number(input.sequence || 0),
      status: input.status || MESSAGE_STATUS.CREATED,
      version: String(input.version || '1'),
      compression: input.compression || { algorithm: 'none', compressed: false, version: '1' },
      encryptionVersion: input.encryptionVersion || 'phase4-aes-256-gcm',
      checksum: input.checksum,
      retryCount: Number(input.retryCount || 0),
      readState: input.readState || { unread: true, read: false, readAt: null },
      futureAttachments: { enabled: false, count: 0 },
      futureReplies: { enabled: false, parentMessageId: null },
      futureReactions: { enabled: false, count: 0 }
    };
  }

  /** @returns {string} MessageID. */
  static messageId() {
    return `msg_${crypto.randomBytes(32).toString('hex')}`;
  }

  /** @param {string} value Ciphertext. @returns {string} SHA-256 checksum. */
  static checksum(value) {
    return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
  }
}

module.exports = MessageModel;
