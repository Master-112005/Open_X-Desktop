/**
 * Manages local pinned conversations.
 */
class PinManager {
  /**
   * Creates pin manager.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.storage = options.storage;
    this.config = options.config;
    this.eventBus = options.eventBus;
    this.events = options.events;
  }

  /**
   * Pins a conversation.
   * @param {object} conversation Conversation.
   * @returns {Promise<object>} Updated conversation.
   */
  async pin(conversation) {
    const pinned = (await this.storage.listConversations()).filter(item => item.pinned && !item.deleted);
    if (!conversation.pinned && pinned.length >= this.config.maxPinnedChats) throw new Error('Pinned chat limit reached.');
    const now = new Date().toISOString();
    conversation.pinned = true;
    conversation.pinOrder = conversation.pinOrder || pinned.length + 1;
    conversation.updatedAt = now;
    await this.storage.upsertConversation(conversation);
    await this.storage.audit({ event: 'Pinned', conversationId: conversation.conversationId });
    this.eventBus?.emit?.(this.events.CONVERSATION_PINNED, { conversationId: conversation.conversationId });
    return conversation;
  }

  /**
   * Unpins a conversation.
   * @param {object} conversation Conversation.
   * @returns {Promise<object>} Updated conversation.
   */
  async unpin(conversation) {
    conversation.pinned = false;
    conversation.pinOrder = 0;
    conversation.updatedAt = new Date().toISOString();
    await this.storage.upsertConversation(conversation);
    await this.storage.audit({ event: 'Unpinned', conversationId: conversation.conversationId });
    this.eventBus?.emit?.(this.events.CONVERSATION_UNPINNED, { conversationId: conversation.conversationId });
    return conversation;
  }
}

module.exports = PinManager;
