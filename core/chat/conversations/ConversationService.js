const ConversationModel = require('./ConversationModel');

/**
 * Local-only conversation service.
 */
class ConversationService {
  /**
   * Creates service.
   * @param {object} options Dependencies.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.storage = options.storage;
    this.validation = options.validation;
    this.indexManager = options.indexManager;
    this.searchService = options.searchService;
    this.pagination = options.pagination;
    this.sorting = options.sorting;
    this.pinManager = options.pinManager;
    this.archiveManager = options.archiveManager;
    this.muteManager = options.muteManager;
    this.eventBus = options.eventBus;
    this.events = options.events;
  }

  /**
   * Creates or returns a local conversation for a relationship.
   * @param {object} input Conversation input.
   * @returns {Promise<object>} Conversation.
   */
  async createConversation(input = {}) {
    await this.storage.initialize();
    const relationshipId = this.validation.relationshipId(input.relationshipId);
    const existing = await this.storage.getConversationByRelationship(relationshipId);
    if (existing) return existing;
    const count = (await this.storage.listConversations()).length;
    if (count >= this.config.maxConversations) throw new Error('Conversation limit reached.');
    const conversation = ConversationModel.create({
      relationshipId,
      metadata: this.validation.metadata(input.metadata),
      sortIndex: count + 1
    });
    await this.storage.upsertConversation(conversation);
    await this.indexManager.indexConversation(conversation);
    await this.storage.audit({ event: 'Created', conversationId: conversation.conversationId, relationshipId });
    this.eventBus?.emit?.(this.events.CONVERSATION_CREATED, { conversationId: conversation.conversationId, relationshipId });
    return conversation;
  }

  /**
   * Gets a conversation.
   * @param {string} conversationId ConversationID.
   * @returns {Promise<object>} Conversation.
   */
  async getConversation(conversationId) {
    const id = this.validation.conversationId(conversationId);
    const conversation = await this.storage.getConversation(id);
    if (!conversation) throw new Error('Conversation is missing.');
    return conversation;
  }

  /**
   * Adds message metadata into local conversation history.
   * @param {object} input Message input.
   * @returns {Promise<object>} Updated conversation.
   */
  async addMessage(input = {}) {
    const conversation = input.conversationId
      ? await this.getConversation(input.conversationId)
      : await this.createConversation({ relationshipId: input.relationshipId, metadata: input.conversationMetadata || {} });
    const now = input.timestamp || new Date().toISOString();
    const messageId = this.validation.messageId(input.messageId);
    conversation.lastMessageId = messageId;
    conversation.lastMessageTimestamp = now;
    conversation.updatedAt = now;
    if (input.unread !== false) conversation.unreadCount += 1;
    conversation.deleted = false;
    conversation.hidden = false;
    await this.storage.upsertConversation(conversation);
    await this.storage.addHistory({
      conversationId: conversation.conversationId,
      relationshipId: conversation.relationshipId,
      messageId,
      timestamp: now,
      messageType: input.messageType || 'Text',
      direction: input.direction || 'incoming',
      senderAccountId: input.senderAccountId || null,
      senderDeviceId: input.senderDeviceId || null,
      recipientAccountId: input.recipientAccountId || null,
      recipientDeviceId: input.recipientDeviceId || null,
      searchText: input.searchText || input.text || input.preview || ''
    });
    await this.indexManager.indexConversation(conversation);
    await this.indexManager.indexMessage({
      conversationId: conversation.conversationId,
      relationshipId: conversation.relationshipId,
      messageId,
      searchText: input.searchText || input.text || input.preview || ''
    });
    return conversation;
  }

  /**
   * Lists conversations with filtering, sorting, and pagination.
   * @param {object} input List input.
   * @returns {Promise<object>} Page.
   */
  async list(input = {}) {
    let conversations = await this.storage.listConversations();
    if (!input.includeDeleted) conversations = conversations.filter(item => !item.deleted);
    if (!input.includeArchived) conversations = conversations.filter(item => !item.archived);
    if (input.onlyArchived) conversations = conversations.filter(item => item.archived && !item.deleted);
    if (input.onlyUnread) conversations = conversations.filter(item => item.unreadCount > 0);
    const sorted = this.sorting.sort(conversations, input.sortBy || this.config.defaultSortingStrategy);
    return this.pagination.paginate(sorted, input);
  }

  /** @param {object} input Search input. @returns {Promise<object>} Search results. */
  search(input = {}) { return this.searchService.search(input); }

  /**
   * Updates local person metadata for an existing conversation.
   * @param {string} conversationId ConversationID.
   * @param {object} metadata Person metadata patch.
   * @returns {Promise<object>} Updated conversation.
   */
  async updateConversationMetadata(conversationId, metadata = {}) {
    const conversation = await this.getConversation(conversationId);
    conversation.metadata = this.validation.metadata({
      ...(conversation.metadata || {}),
      ...metadata
    });
    conversation.updatedAt = new Date().toISOString();
    await this.storage.upsertConversation(conversation);
    await this.indexManager.indexConversation(conversation);
    await this.storage.audit({ event: 'Updated', conversationId: conversation.conversationId });
    this.eventBus?.emit?.(this.events.CONVERSATION_UPDATED, { conversationId: conversation.conversationId });
    return conversation;
  }

  /** @param {string} conversationId ConversationID. @returns {Promise<object>} Updated conversation. */
  async pin(conversationId) { return this.pinManager.pin(await this.getConversation(conversationId)); }

  /** @param {string} conversationId ConversationID. @returns {Promise<object>} Updated conversation. */
  async unpin(conversationId) { return this.pinManager.unpin(await this.getConversation(conversationId)); }

  /** @param {string} conversationId ConversationID. @returns {Promise<object>} Updated conversation. */
  async archive(conversationId) { return this.archiveManager.archive(await this.getConversation(conversationId)); }

  /** @param {string} conversationId ConversationID. @returns {Promise<object>} Updated conversation. */
  async unarchive(conversationId) { return this.archiveManager.unarchive(await this.getConversation(conversationId)); }

  /** @param {string} conversationId ConversationID. @param {object} options Mute options. @returns {Promise<object>} Updated conversation. */
  async mute(conversationId, options = {}) { return this.muteManager.mute(await this.getConversation(conversationId), options); }

  /** @param {string} conversationId ConversationID. @returns {Promise<object>} Updated conversation. */
  async unmute(conversationId) { return this.muteManager.unmute(await this.getConversation(conversationId)); }

  /**
   * Soft deletes a conversation locally.
   * @param {string} conversationId ConversationID.
   * @returns {Promise<object>} Updated conversation.
   */
  async deleteConversation(conversationId) {
    const conversation = await this.getConversation(conversationId);
    conversation.deleted = true;
    conversation.hidden = true;
    conversation.updatedAt = new Date().toISOString();
    await this.storage.upsertConversation(conversation);
    await this.storage.audit({ event: 'Deleted', conversationId: conversation.conversationId });
    this.eventBus?.emit?.(this.events.CONVERSATION_DELETED, { conversationId: conversation.conversationId });
    return conversation;
  }

  /**
   * Restores a soft-deleted conversation.
   * @param {string} conversationId ConversationID.
   * @returns {Promise<object>} Updated conversation.
   */
  async restoreConversation(conversationId) {
    const conversation = await this.getConversation(conversationId);
    conversation.deleted = false;
    conversation.hidden = false;
    conversation.updatedAt = new Date().toISOString();
    await this.storage.upsertConversation(conversation);
    await this.storage.audit({ event: 'Restored', conversationId: conversation.conversationId });
    this.eventBus?.emit?.(this.events.CONVERSATION_RESTORED, { conversationId: conversation.conversationId });
    return conversation;
  }

  /**
   * Permanently removes local conversation metadata and local history.
   * @param {string} conversationId ConversationID.
   * @returns {Promise<object>} Delete result.
   */
  async permanentlyDelete(conversationId) {
    const id = this.validation.conversationId(conversationId);
    await this.storage.removeConversation(id);
    await this.storage.audit({ event: 'PermanentlyDeleted', conversationId: id });
    return { conversationId: id, deleted: true };
  }

  /**
   * Clears local message history while keeping relationship metadata.
   * @param {string} conversationId ConversationID.
   * @returns {Promise<object>} Updated conversation.
   */
  async clearHistory(conversationId) {
    const conversation = await this.getConversation(conversationId);
    await this.storage.clearHistory(conversation.conversationId);
    conversation.lastMessageId = null;
    conversation.lastMessageTimestamp = null;
    conversation.unreadCount = 0;
    conversation.updatedAt = new Date().toISOString();
    await this.storage.upsertConversation(conversation);
    await this.indexManager.indexConversation(conversation);
    await this.storage.audit({ event: 'Cleared', conversationId: conversation.conversationId });
    this.eventBus?.emit?.(this.events.CONVERSATION_CLEARED, { conversationId: conversation.conversationId });
    return conversation;
  }

  /**
   * Marks a conversation read.
   * @param {string} conversationId ConversationID.
   * @returns {Promise<object>} Updated conversation.
   */
  async markRead(conversationId) {
    const conversation = await this.getConversation(conversationId);
    conversation.unreadCount = 0;
    conversation.lastOpened = new Date().toISOString();
    conversation.updatedAt = conversation.lastOpened;
    await this.storage.upsertConversation(conversation);
    this.eventBus?.emit?.(this.events.CONVERSATION_MARKED_READ, { conversationId: conversation.conversationId });
    return conversation;
  }

  /**
   * Marks a conversation unread.
   * @param {string} conversationId ConversationID.
   * @param {number} count Unread count.
   * @returns {Promise<object>} Updated conversation.
   */
  async markUnread(conversationId, count = 1) {
    const conversation = await this.getConversation(conversationId);
    conversation.unreadCount = Math.max(1, Number(count || 1));
    conversation.updatedAt = new Date().toISOString();
    await this.storage.upsertConversation(conversation);
    this.eventBus?.emit?.(this.events.CONVERSATION_MARKED_UNREAD, { conversationId: conversation.conversationId, unreadCount: conversation.unreadCount });
    return conversation;
  }
}

module.exports = ConversationService;
