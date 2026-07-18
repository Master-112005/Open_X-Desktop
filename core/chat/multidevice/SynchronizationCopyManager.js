const fs = require('fs/promises');
const path = require('path');

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
    await fs.mkdir(path.dirname(this.config.storagePath), { recursive: true });
    try {
      this.state = this.normalize(JSON.parse(await fs.readFile(this.config.storagePath, 'utf8')));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.persist();
    }
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
      const tempPath = `${this.config.storagePath}.tmp`;
      await fs.writeFile(tempPath, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
      await fs.rename(tempPath, this.config.storagePath);
    });
    await this.writeQueue;
  }
}

module.exports = SynchronizationCopyManager;
