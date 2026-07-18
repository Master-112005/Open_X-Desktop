const crypto = require('crypto');

/**
 * Local conversation record factory.
 */
class ConversationModel {
  /** @returns {string} ConversationID. */
  static conversationId() {
    return `conv_${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Creates a conversation record.
   * @param {object} input Conversation input.
   * @returns {object} Conversation record.
   */
  static create(input = {}) {
    const now = new Date(input.now || Date.now()).toISOString();
    return {
      conversationId: input.conversationId || ConversationModel.conversationId(),
      relationshipId: input.relationshipId,
      lastMessageId: input.lastMessageId || null,
      lastMessageTimestamp: input.lastMessageTimestamp || null,
      unreadCount: Number(input.unreadCount || 0),
      pinned: Boolean(input.pinned),
      archived: Boolean(input.archived),
      muted: Boolean(input.muted),
      deleted: Boolean(input.deleted),
      hidden: Boolean(input.hidden),
      favorite: Boolean(input.favorite),
      lastOpened: input.lastOpened || null,
      createdAt: input.createdAt || now,
      updatedAt: input.updatedAt || now,
      sortIndex: Number(input.sortIndex || 0),
      metadata: input.metadata || {},
      muteUntil: input.muteUntil || null,
      pinOrder: Number(input.pinOrder || 0),
      futureGroups: input.futureGroups || { enabled: false, groupId: null },
      futureFolders: input.futureFolders || { enabled: false, folderId: null }
    };
  }
}

module.exports = ConversationModel;
