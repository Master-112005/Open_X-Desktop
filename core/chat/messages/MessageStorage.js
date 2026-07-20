const fs = require('fs/promises');
const path = require('path');

/**
 * Desktop local encrypted message storage.
 */
class MessageStorage {
  /**
   * Creates message storage.
   * @param {object} options Storage options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.state = this.empty();
    this.started = false;
    this.writeQueue = Promise.resolve();
  }

  /**
   * Initializes storage on disk.
   */
  async initialize() {
    if (this.started) return;
    await fs.mkdir(path.dirname(this.config.storagePath), { recursive: true });
    try {
      this.state = this.normalize(JSON.parse(await fs.readFile(this.config.storagePath, 'utf8')));
      this.pruneMessages();
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.state = this.empty();
      await this.persist();
    }
    this.started = true;
  }

  /**
   * Creates empty local tables.
   * @returns {object} Empty state.
   */
  empty() {
    return {
      version: 1,
      messages: [],
      messageStatus: [],
      readState: [],
      retryQueue: [],
      typingState: [],
      compressionMetadata: [],
      futureAttachmentPlaceholder: [],
      futureReactionPlaceholder: []
    };
  }

  /**
   * Normalizes loaded state.
   * @param {object} state State.
   * @returns {object} Normalized state.
   */
  normalize(state) {
    const empty = this.empty();
    return {
      version: Number(state?.version || 1),
      ...Object.fromEntries(Object.keys(empty).filter(key => key !== 'version').map(key => [key, Array.isArray(state?.[key]) ? state[key] : empty[key]]))
    };
  }

  /**
   * Upserts a local encrypted message.
   * @param {object} message Message.
   */
  async upsertMessage(message) {
    await this.initialize();
    const index = this.state.messages.findIndex(item => item.messageId === message.messageId);
    if (index >= 0) this.state.messages[index] = message;
    else this.state.messages.push(message);
    await this.setStatus(message.messageId, message.status, false);
    await this.persist();
  }

  /**
   * Prunes local message-related tables to the configured retention cap.
   */
  pruneMessages() {
    const limit = Math.max(1, Math.floor(Number(this.config.maxStoredMessages) || 300));
    const retainedMessages = this.state.messages.length > limit
      ? this.state.messages.slice(-limit)
      : this.state.messages;
    const keepIds = new Set(retainedMessages.map(message => message.messageId).filter(Boolean));
    this.state.messages = retainedMessages;
    for (const key of ['messageStatus', 'readState', 'retryQueue', 'compressionMetadata', 'futureAttachmentPlaceholder', 'futureReactionPlaceholder']) {
      this.state[key] = this.state[key].filter(item => keepIds.has(item.messageId));
    }
  }

  /**
   * Gets a message by ID.
   * @param {string} messageId MessageID.
   * @returns {Promise<object|null>} Message.
   */
  async getMessage(messageId) {
    await this.initialize();
    return this.state.messages.find(message => message.messageId === messageId) || null;
  }

  /**
   * Sets message status.
   * @param {string} messageId MessageID.
   * @param {string} status Status.
   * @param {boolean} persist Whether to persist immediately.
   */
  async setStatus(messageId, status, persist = true) {
    const now = new Date().toISOString();
    const record = { messageId, status, updatedAt: now };
    const index = this.state.messageStatus.findIndex(item => item.messageId === messageId);
    if (index >= 0) this.state.messageStatus[index] = record;
    else this.state.messageStatus.push(record);
    const message = this.state.messages.find(item => item.messageId === messageId);
    if (message) message.status = status;
    if (persist) await this.persist();
  }

  /**
   * Marks a message as read locally.
   * @param {string} messageId MessageID.
   * @param {string|null} readAt Read timestamp.
   */
  async markRead(messageId, readAt = null) {
    await this.initialize();
    const state = { messageId, unread: false, read: true, readAt: readAt || new Date().toISOString() };
    const index = this.state.readState.findIndex(item => item.messageId === messageId);
    if (index >= 0) this.state.readState[index] = state;
    else this.state.readState.push(state);
    const message = this.state.messages.find(item => item.messageId === messageId);
    if (message) message.readState = state;
    await this.persist();
  }

  /**
   * Adds retry state for a message.
   * @param {object} retry Retry record.
   */
  async upsertRetry(retry) {
    await this.initialize();
    const index = this.state.retryQueue.findIndex(item => item.messageId === retry.messageId);
    if (index >= 0) this.state.retryQueue[index] = retry;
    else this.state.retryQueue.push(retry);
    await this.persist();
  }

  /**
   * Persists state atomically.
   */
  async persist() {
    this.pruneMessages();
    this.writeQueue = this.writeQueue.then(async () => {
      const tempPath = `${this.config.storagePath}.tmp`;
      await fs.writeFile(tempPath, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
      await fs.rename(tempPath, this.config.storagePath);
    });
    await this.writeQueue;
  }
}

module.exports = MessageStorage;
