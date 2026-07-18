const SynchronizationConfiguration = require('./SynchronizationConfiguration');
const SynchronizationEvents = require('./SynchronizationEvents');
const SynchronizationLogger = require('./SynchronizationLogger');
const SynchronizationClient = require('./SynchronizationClient');
const SynchronizationCursor = require('./SynchronizationCursor');
const SequenceManager = require('./SequenceManager');
const ACKManager = require('./ACKManager');
const RecoveryManager = require('./RecoveryManager');
const ConflictManager = require('./ConflictManager');
const RetryManager = require('./RetryManager');
const SynchronizationEngine = require('./SynchronizationEngine');

/**
 * Desktop Phase 9 reliable synchronization facade.
 */
class SynchronizationManager {
  /**
   * Creates sync manager.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.config = options.config instanceof SynchronizationConfiguration ? options.config : new SynchronizationConfiguration(options.config || {});
    this.eventBus = options.eventBus;
    this.logger = options.logger || new SynchronizationLogger();
    this.client = options.client || new SynchronizationClient({ config: this.config, fetchImpl: options.fetchImpl });
    this.cursorStore = options.cursorStore || new SynchronizationCursor({ config: this.config, eventBus: this.eventBus, events: SynchronizationEvents });
    this.sequenceManager = options.sequenceManager || new SequenceManager();
    this.recoveryManager = options.recoveryManager || new RecoveryManager();
    this.conflictManager = options.conflictManager || new ConflictManager();
    this.retryManager = options.retryManager || new RetryManager({ config: this.config });
    this.ackManager = options.ackManager || new ACKManager({
      client: this.client,
      cursorStore: this.cursorStore,
      eventBus: this.eventBus,
      events: SynchronizationEvents
    });
    this.engine = options.engine || new SynchronizationEngine({
      config: this.config,
      client: this.client,
      cursorStore: this.cursorStore,
      sequenceManager: this.sequenceManager,
      ackManager: this.ackManager,
      recoveryManager: this.recoveryManager,
      conflictManager: this.conflictManager,
      retryManager: this.retryManager,
      messageManager: options.messageManager,
      eventBus: this.eventBus,
      events: SynchronizationEvents
    });
  }

  /** @param {object} input Sync input. @returns {Promise<object>} Sync result. */
  synchronize(input = {}) { return this.engine.synchronize(input); }

  /** @param {object} input Alias sync input. @returns {Promise<object>} Sync result. */
  sync(input = {}) { return this.synchronize(input); }

  /** @param {string} deviceId DeviceID. @returns {Promise<object>} Status. */
  status(deviceId) { return this.engine.status(deviceId); }

  /** @param {object} input Retry input. @returns {Promise<object>} Retry result. */
  retry(input = {}) { return this.engine.retry(input); }
}

module.exports = SynchronizationManager;
