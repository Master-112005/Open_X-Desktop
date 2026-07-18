const { chatDataPath } = require('../ChatDataPaths');

/**
 * Desktop Phase 13 local conversation configuration.
 */
class ConversationConfiguration {
  /**
   * Creates configuration.
   * @param {object} options Overrides.
   */
  constructor(options = {}) {
    this.storagePath = options.storagePath || chatDataPath('chat-conversations.json', options);
    this.maxConversations = this.number(options.maxConversations, 10000);
    this.defaultPageSize = this.number(options.defaultPageSize, 30);
    this.maxPageSize = this.number(options.maxPageSize, 100);
    this.maxPinnedChats = this.number(options.maxPinnedChats, 5);
    this.maxArchiveLimit = this.number(options.maxArchiveLimit, 10000);
    this.searchDepth = this.number(options.searchDepth, 1000);
    this.maxSearchResults = this.number(options.maxSearchResults, 100);
    this.indexOptimizationThreshold = this.number(options.indexOptimizationThreshold, 5000);
    this.defaultSortingStrategy = String(options.defaultSortingStrategy || 'default');
    this.futureFoldersEnabled = options.futureFoldersEnabled === true;
    this.validate();
    Object.freeze(this);
  }

  /**
   * Parses number.
   * @param {*} value Candidate.
   * @param {number} fallback Fallback.
   * @returns {number} Parsed number.
   */
  number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  /**
   * Validates configuration.
   */
  validate() {
    if (this.maxConversations < 1) throw new Error('Maximum conversations must be positive.');
    if (this.defaultPageSize < 1) throw new Error('Conversation page size must be positive.');
    if (this.maxPageSize < this.defaultPageSize) throw new Error('Maximum page size must be >= default page size.');
    if (this.maxPinnedChats < 0) throw new Error('Pinned chat limit must be >= 0.');
    if (this.searchDepth < 1) throw new Error('Search depth must be positive.');
  }
}

module.exports = ConversationConfiguration;
