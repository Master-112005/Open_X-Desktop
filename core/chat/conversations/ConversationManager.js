const ArchiveManager = require('./ArchiveManager');
const ConversationConfiguration = require('./ConversationConfiguration');
const ConversationEvents = require('./ConversationEvents');
const ConversationLogger = require('./ConversationLogger');
const ConversationService = require('./ConversationService');
const ConversationStorage = require('./ConversationStorage');
const ConversationValidation = require('./ConversationValidation');
const IndexManager = require('./IndexManager');
const MuteManager = require('./MuteManager');
const PaginationManager = require('./PaginationManager');
const PinManager = require('./PinManager');
const SearchManager = require('./SearchManager');
const SearchService = require('./SearchService');
const SortingManager = require('./SortingManager');

/**
 * Desktop Phase 13 local conversation facade.
 */
class ConversationManager {
  /**
   * Creates conversation manager.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.config = options.config instanceof ConversationConfiguration
      ? options.config
      : new ConversationConfiguration(options.config || {});
    this.eventBus = options.eventBus;
    this.logger = options.logger || new ConversationLogger();
    this.storage = options.storage || new ConversationStorage({ config: this.config });
    this.validation = options.validation || new ConversationValidation({ config: this.config });
    this.pagination = options.pagination || new PaginationManager({ config: this.config, eventBus: this.eventBus, events: ConversationEvents });
    this.sorting = options.sorting || new SortingManager({ config: this.config });
    this.indexManager = options.indexManager || new IndexManager({ storage: this.storage, eventBus: this.eventBus, events: ConversationEvents });
    this.searchService = options.searchService || new SearchService({
      storage: this.storage,
      indexManager: this.indexManager,
      pagination: this.pagination,
      sorting: this.sorting,
      eventBus: this.eventBus,
      events: ConversationEvents
    });
    this.searchManager = options.searchManager || new SearchManager({ service: this.searchService, indexManager: this.indexManager });
    this.pinManager = options.pinManager || new PinManager({ storage: this.storage, config: this.config, eventBus: this.eventBus, events: ConversationEvents });
    this.archiveManager = options.archiveManager || new ArchiveManager({ storage: this.storage, eventBus: this.eventBus, events: ConversationEvents });
    this.muteManager = options.muteManager || new MuteManager({ storage: this.storage, eventBus: this.eventBus, events: ConversationEvents });
    this.service = options.service || new ConversationService({
      config: this.config,
      storage: this.storage,
      validation: this.validation,
      indexManager: this.indexManager,
      searchService: this.searchService,
      pagination: this.pagination,
      sorting: this.sorting,
      pinManager: this.pinManager,
      archiveManager: this.archiveManager,
      muteManager: this.muteManager,
      eventBus: this.eventBus,
      events: ConversationEvents
    });
  }

  /** @returns {Promise<void>} Initialization result. */
  initialize() { return this.storage.initialize(); }

  /** @param {object} input Input. @returns {Promise<object>} Conversation. */
  createConversation(input = {}) { return this.service.createConversation(input); }

  /** @param {object} input Input. @returns {Promise<object>} Page. */
  list(input = {}) { return this.service.list(input); }

  /** @param {object} input Input. @returns {Promise<object>} Page. */
  search(input = {}) { return this.service.search(input); }

  /** @param {object} input Message input. @returns {Promise<object>} Conversation. */
  addMessage(input = {}) { return this.service.addMessage(input); }

  /** @param {string} id ConversationID. @returns {Promise<object>} Conversation. */
  getConversation(id) { return this.service.getConversation(id); }

  /** @param {string} id ConversationID. @param {object} metadata Metadata patch. @returns {Promise<object>} Conversation. */
  updateConversationMetadata(id, metadata = {}) { return this.service.updateConversationMetadata(id, metadata); }

  /** @param {string} id ConversationID. @returns {Promise<object>} Conversation. */
  pin(id) { return this.service.pin(id); }

  /** @param {string} id ConversationID. @returns {Promise<object>} Conversation. */
  unpin(id) { return this.service.unpin(id); }

  /** @param {string} id ConversationID. @returns {Promise<object>} Conversation. */
  archive(id) { return this.service.archive(id); }

  /** @param {string} id ConversationID. @returns {Promise<object>} Conversation. */
  unarchive(id) { return this.service.unarchive(id); }

  /** @param {string} id ConversationID. @param {object} options Options. @returns {Promise<object>} Conversation. */
  mute(id, options = {}) { return this.service.mute(id, options); }

  /** @param {string} id ConversationID. @returns {Promise<object>} Conversation. */
  unmute(id) { return this.service.unmute(id); }

  /** @param {string} id ConversationID. @returns {Promise<object>} Conversation. */
  deleteConversation(id) { return this.service.deleteConversation(id); }

  /** @param {string} id ConversationID. @returns {Promise<object>} Conversation. */
  restoreConversation(id) { return this.service.restoreConversation(id); }

  /** @param {string} id ConversationID. @returns {Promise<object>} Result. */
  permanentlyDelete(id) { return this.service.permanentlyDelete(id); }

  /** @param {string} id ConversationID. @returns {Promise<object>} Conversation. */
  clearHistory(id) { return this.service.clearHistory(id); }

  /** @param {string} id ConversationID. @returns {Promise<object>} Conversation. */
  markRead(id) { return this.service.markRead(id); }

  /** @param {string} id ConversationID. @param {number} count Count. @returns {Promise<object>} Conversation. */
  markUnread(id, count = 1) { return this.service.markUnread(id, count); }

  /** @returns {SearchManager} Search manager. */
  getSearchManager() { return this.searchManager; }
}

ConversationManager.Events = ConversationEvents;

module.exports = ConversationManager;
