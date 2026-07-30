const { readSecureJsonFile, writeSecureJsonAtomic } = require('../../assistant/Data');

/**
 * Desktop local conversation database.
 */
class ConversationStorage {
  /**
   * Creates storage.
   * @param {object} options Storage options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.state = this.empty();
    this.started = false;
    this.writeQueue = Promise.resolve();
  }

  /**
   * Initializes local database.
   */
  async initialize() {
    if (this.started) return;
    this.state = this.normalize(readSecureJsonFile(this.config.storagePath, () => this.empty(), {
      createIfMissing: true,
      validate: value => value && typeof value === 'object'
    }));
    this.started = true;
  }

  /**
   * Creates empty local conversation tables.
   * @returns {object} Empty database.
   */
  empty() {
    return {
      version: 1,
      Conversations: [],
      ConversationMetadata: [],
      ConversationIndex: [],
      PinnedChats: [],
      ArchivedChats: [],
      MutedChats: [],
      DeletedChats: [],
      SearchIndex: [],
      ConversationHistory: [],
      ConversationAudit: [],
      LocalStatistics: [],
      FutureFolders: [],
      FutureGroups: []
    };
  }

  /**
   * Normalizes loaded database.
   * @param {object} state Loaded state.
   * @returns {object} Normalized state.
   */
  normalize(state) {
    const empty = this.empty();
    const output = { version: Number(state?.version || 1) };
    for (const key of Object.keys(empty).filter(item => item !== 'version')) {
      output[key] = Array.isArray(state?.[key]) ? state[key] : [];
    }
    return output;
  }

  /**
   * Lists conversations.
   * @returns {Promise<object[]>} Conversations.
   */
  async listConversations() {
    await this.initialize();
    return this.state.Conversations.map(item => this.clone(item));
  }

  /**
   * Finds conversation by ID.
   * @param {string} conversationId ConversationID.
   * @returns {Promise<object|null>} Conversation.
   */
  async getConversation(conversationId) {
    await this.initialize();
    return this.clone(this.state.Conversations.find(item => item.conversationId === conversationId) || null);
  }

  /**
   * Finds conversation by relationship.
   * @param {string} relationshipId RelationshipID.
   * @returns {Promise<object|null>} Conversation.
   */
  async getConversationByRelationship(relationshipId) {
    await this.initialize();
    return this.clone(this.state.Conversations.find(item => item.relationshipId === relationshipId && !item.deleted) || null);
  }

  /**
   * Upserts a conversation and derived metadata tables.
   * @param {object} conversation Conversation.
   */
  async upsertConversation(conversation) {
    await this.initialize();
    const record = this.clone(conversation);
    const index = this.state.Conversations.findIndex(item => item.conversationId === conversation.conversationId);
    if (index >= 0) this.state.Conversations[index] = record;
    else this.state.Conversations.push(record);
    this.syncDerivedTables(record);
    await this.persist();
  }

  /**
   * Removes a conversation and all local conversation data.
   * @param {string} conversationId ConversationID.
   */
  async removeConversation(conversationId) {
    await this.initialize();
    for (const key of ['Conversations', 'ConversationMetadata', 'ConversationIndex', 'PinnedChats', 'ArchivedChats', 'MutedChats', 'DeletedChats', 'SearchIndex', 'ConversationHistory']) {
      this.state[key] = this.state[key].filter(item => item.conversationId !== conversationId);
    }
    await this.persist();
  }

  /**
   * Adds a local history record.
   * @param {object} record History record.
   */
  async addHistory(record) {
    await this.initialize();
    const entry = this.clone(record);
    const index = this.state.ConversationHistory.findIndex(item => item.messageId && item.messageId === record.messageId);
    if (index >= 0) this.state.ConversationHistory[index] = entry;
    else this.state.ConversationHistory.push(entry);
    this.pruneHistory(record.conversationId);
    await this.persist();
  }

  /**
   * Prunes a conversation to the configured local history cap.
   * @param {string} conversationId ConversationID.
   */
  pruneHistory(conversationId) {
    const limit = Math.max(1, Math.floor(Number(this.config.maxHistoryPerConversation) || 300));
    const history = this.state.ConversationHistory.filter(item => item.conversationId === conversationId);
    if (history.length <= limit) return;
    const keepIds = new Set(history.slice(-limit).map(item => item.messageId).filter(Boolean));
    this.state.ConversationHistory = this.state.ConversationHistory.filter(item => (
      item.conversationId !== conversationId || keepIds.has(item.messageId)
    ));
    this.state.SearchIndex = this.state.SearchIndex.filter(item => (
      item.conversationId !== conversationId || item.type !== 'Message' || keepIds.has(item.messageId)
    ));
  }

  /**
   * Lists local history for a conversation.
   * @param {string} conversationId ConversationID.
   * @returns {Promise<object[]>} History.
   */
  async listHistory(conversationId) {
    await this.initialize();
    return this.state.ConversationHistory.filter(item => item.conversationId === conversationId).map(item => this.clone(item));
  }

  /**
   * Clears local conversation history and message indexes.
   * @param {string} conversationId ConversationID.
   */
  async clearHistory(conversationId) {
    await this.initialize();
    this.state.ConversationHistory = this.state.ConversationHistory.filter(item => item.conversationId !== conversationId);
    this.state.SearchIndex = this.state.SearchIndex.filter(item => !(item.conversationId === conversationId && item.type === 'Message'));
    await this.persist();
  }

  /**
   * Replaces search index records for a conversation/type.
   * @param {string} conversationId ConversationID.
   * @param {string|null} type Optional type.
   * @param {object[]} records Records.
   */
  async replaceIndex(conversationId, type, records) {
    await this.initialize();
    this.state.SearchIndex = this.state.SearchIndex.filter(item => {
      if (item.conversationId !== conversationId) return true;
      return type ? item.type !== type : false;
    });
    this.state.SearchIndex.push(...records);
    await this.persist();
  }

  /**
   * Upserts a single search index record.
   * @param {object} record Index record.
   */
  async upsertSearchRecord(record) {
    await this.initialize();
    const index = this.state.SearchIndex.findIndex(item => item.indexId === record.indexId);
    if (index >= 0) this.state.SearchIndex[index] = record;
    else this.state.SearchIndex.push(record);
    await this.persist();
  }

  /**
   * Lists search index records.
   * @returns {Promise<object[]>} Search index.
   */
  async listSearchIndex() {
    await this.initialize();
    return this.state.SearchIndex.map(item => this.clone(item));
  }

  /**
   * Clones a JSON-safe value.
   * @param {*} value Value.
   * @returns {*} Clone.
   */
  clone(value) {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
  }

  /**
   * Records a privacy-safe audit event.
   * @param {object} event Audit event.
   */
  async audit(event) {
    await this.initialize();
    const safe = { ...event };
    delete safe.text;
    delete safe.plaintext;
    delete safe.content;
    delete safe.message;
    this.state.ConversationAudit.push({ ...safe, createdAt: safe.createdAt || new Date().toISOString() });
    await this.persist();
  }

  /**
   * Updates derived local tables from the canonical conversation record.
   * @param {object} conversation Conversation.
   */
  syncDerivedTables(conversation) {
    this.state.ConversationMetadata = this.state.ConversationMetadata.filter(item => item.conversationId !== conversation.conversationId);
    this.state.ConversationMetadata.push({
      conversationId: conversation.conversationId,
      relationshipId: conversation.relationshipId,
      metadata: conversation.metadata,
      updatedAt: conversation.updatedAt
    });
    this.state.PinnedChats = this.upsertFlagTable(this.state.PinnedChats, conversation, conversation.pinned, { pinOrder: conversation.pinOrder });
    this.state.ArchivedChats = this.upsertFlagTable(this.state.ArchivedChats, conversation, conversation.archived);
    this.state.MutedChats = this.upsertFlagTable(this.state.MutedChats, conversation, conversation.muted, { muteUntil: conversation.muteUntil });
    this.state.DeletedChats = this.upsertFlagTable(this.state.DeletedChats, conversation, conversation.deleted);
  }

  /**
   * Updates one derived flag table.
   * @param {object[]} table Table.
   * @param {object} conversation Conversation.
   * @param {boolean} enabled Whether enabled.
   * @param {object} extra Extra fields.
   * @returns {object[]} Updated table.
   */
  upsertFlagTable(table, conversation, enabled, extra = {}) {
    const filtered = table.filter(item => item.conversationId !== conversation.conversationId);
    if (!enabled) return filtered;
    filtered.push({
      conversationId: conversation.conversationId,
      relationshipId: conversation.relationshipId,
      updatedAt: conversation.updatedAt,
      ...extra
    });
    return filtered;
  }

  /**
   * Persists database atomically.
   */
  async persist() {
    this.writeQueue = this.writeQueue.then(async () => {
      writeSecureJsonAtomic(this.config.storagePath, this.state, { backup: true });
    });
    await this.writeQueue;
  }
}

module.exports = ConversationStorage;
