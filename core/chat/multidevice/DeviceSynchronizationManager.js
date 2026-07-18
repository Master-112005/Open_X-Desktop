/**
 * Desktop device synchronization manager.
 */
class DeviceSynchronizationManager {
  /**
   * Creates manager.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.client = options.client;
    this.eventBus = options.eventBus;
    this.events = options.events;
  }

  /** @param {object} input Sync input. @returns {Promise<object>} Sync result. */
  async synchronize(input = {}) {
    this.eventBus?.emit?.(this.events.DEVICE_SYNCHRONIZATION_STARTED, { deviceId: input.deviceId, afterSequence: input.afterSequence || 0 });
    const result = await this.client.synchronizeDevice(input);
    this.eventBus?.emit?.(this.events.DEVICE_SYNCHRONIZATION_COMPLETED, { deviceId: input.deviceId, sequence: result.highestContiguousSequence });
    return result;
  }
}

module.exports = DeviceSynchronizationManager;
