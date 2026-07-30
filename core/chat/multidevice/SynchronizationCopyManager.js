const { readSecureJsonFile, writeSecureJsonAtomic } = require('../../assistant/Data');

/**
 * Desktop local synchronization-copy metadata store.
 */
class SynchronizationCopyManager {
  /**
   * Creates copy manager.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.eventBus = options.eventBus;
    this.events = options.events;
    this.state = { version: 1, synchronizationCopies: [], deviceSynchronization: [], deviceConsistency: [], deviceQueues: [], routingHistory: [], futureGroupRouting: [] };
    this.started = false;
    this.writeQueue = Promise.resolve();
  }

  /**
   * Initializes storage.
   */
  async initialize() {
    if (this.started) return;
    this.state = this.normalize(readSecureJsonFile(this.config.storagePath, () => this.state, {
      createIfMissing: true,
      validate: value => value && typeof value === 'object'
    }));
    this.started = true;
  }

  /** @param {object} state State. @returns {object} Normalized state. */
  normalize(state = {}) {
    const empty = this.state;
    return {
      version: Number(state.version || 1),
      ...Object.fromEntries(Object.keys(empty).filter(key => key !== 'version').map(key => [key, Array.isArray(state[key]) ? state[key] : []]))
    };
  }

  /** @param {object} copy Copy record. */
  async recordCopy(copy) {
    await this.initialize();
    this.state.synchronizationCopies.push(copy);
    await this.persist();
    this.eventBus?.emit?.(this.events.SYNCHRONIZATION_COPY_CREATED, { copyId: copy.copyId, targetDeviceId: copy.targetDeviceId });
  }

  /** @param {object} consistency Consistency record. */
  async recordConsistency(consistency) {
    await this.initialize();
    this.state.deviceConsistency.push(consistency);
    await this.persist();
    this.eventBus?.emit?.(this.events.CONSISTENCY_UPDATED, { consistent: consistency.consistent });
  }

  /** @param {object} queue Queue record. */
  async recordQueue(queue) {
    await this.initialize();
    const index = this.state.deviceQueues.findIndex(item => item.deviceId === queue.deviceId);
    if (index >= 0) this.state.deviceQueues[index] = queue;
    else this.state.deviceQueues.push(queue);
    await this.persist();
    this.eventBus?.emit?.(this.events.DEVICE_QUEUE_UPDATED, { deviceId: queue.deviceId, currentSequence: queue.currentSequence });
  }

  /**
   * Persists state atomically.
   */
  async persist() {
    this.writeQueue = this.writeQueue.then(async () => {
      writeSecureJsonAtomic(this.config.storagePath, this.state, { backup: true });
    });
    await this.writeQueue;
  }
}

module.exports = SynchronizationCopyManager;
