const HistorySynchronizationConfiguration = require('./HistorySynchronizationConfiguration');
const HistorySynchronizationClient = require('./HistorySynchronizationClient');
const HistorySynchronizationStorage = require('./HistorySynchronizationStorage');
const HistoryTransferEngine = require('./HistoryTransferEngine');
const Events = require('./HistorySynchronizationEvents');

/**
 * Desktop manager for trusted-device local chat history synchronization.
 */
class HistorySynchronizationManager {
  /**
   * Creates manager.
   * @param {object} options Manager dependencies.
   */
  constructor(options = {}) {
    this.config = options.config instanceof HistorySynchronizationConfiguration
      ? options.config
      : new HistorySynchronizationConfiguration(options);
    this.client = options.client || new HistorySynchronizationClient({ config: this.config, fetchImpl: options.fetchImpl });
    this.storage = options.storage || new HistorySynchronizationStorage({ config: this.config });
    this.transferEngine = options.transferEngine || new HistoryTransferEngine({
      config: this.config,
      storage: this.storage,
      eventBus: options.eventBus
    });
    this.eventBus = options.eventBus || null;
  }

  /**
   * Requests server coordination for trusted-device history sync.
   * @param {object} input Request input.
   * @returns {Promise<object>} Server request metadata.
   */
  async requestSynchronization(input = {}) {
    const manifest = this.transferEngine.createEncryptedExportManifest({
      accountId: input.accountId,
      deviceId: input.deviceId,
      ...input.manifest
    });
    const result = await this.client.requestSynchronization({
      accountId: input.accountId,
      deviceId: input.deviceId,
      reason: input.reason || 'new-device-setup',
      manifest
    });
    await this.storage.upsertRequest(result);
    await this.storage.audit({
      type: Events.REQUESTED,
      accountId: input.accountId,
      deviceId: input.deviceId,
      syncRequestId: result.syncRequestId,
      status: result.status
    });
    this.eventBus?.emit?.(result.available ? Events.SOURCE_AVAILABLE : Events.WAITING_FOR_SOURCE, result);
    return result;
  }

  /**
   * Checks whether another trusted device can provide local history.
   * @param {object} input Availability input.
   * @returns {Promise<object>} Availability metadata.
   */
  async checkAvailability(input = {}) {
    const result = await this.client.availability(input);
    await this.storage.recordSourceAvailability({
      accountId: input.accountId,
      deviceId: input.deviceId,
      available: result.available,
      sourceDeviceId: result.sourceDeviceId || null,
      updatedAt: new Date().toISOString()
    });
    return result;
  }

  /**
   * Negotiates transfer metadata for an existing sync request.
   * @param {object} input Negotiation input.
   * @returns {Promise<object>} Negotiation result.
   */
  async negotiate(input = {}) {
    const result = await this.client.negotiate(input);
    await this.storage.upsertRequest(result.request);
    await this.storage.upsertTransfer(result.transfer);
    await this.storage.audit({
      type: Events.NEGOTIATED,
      accountId: result.request.accountId,
      syncRequestId: result.request.syncRequestId,
      transferId: result.transfer.transferId
    });
    this.eventBus?.emit?.(Events.NEGOTIATED, result);
    return result;
  }

  /**
   * Completes history synchronization after client-side import succeeds.
   * @param {object} input Completion input.
   * @returns {Promise<object>} Completion result.
   */
  async complete(input = {}) {
    const result = await this.client.complete(input);
    await this.storage.upsertRequest(result);
    if (input.transferId) {
      await this.transferEngine.completeTransfer({
        transferId: input.transferId,
        syncRequestId: input.syncRequestId,
        ...input.integrity
      });
    }
    await this.storage.audit({
      type: Events.COMPLETED,
      accountId: result.accountId,
      syncRequestId: result.syncRequestId,
      status: result.status
    });
    this.eventBus?.emit?.(Events.COMPLETED, result);
    return result;
  }

  /**
   * Cancels an active history synchronization request.
   * @param {object} input Cancel input.
   * @returns {Promise<object>} Cancel result.
   */
  async cancel(input = {}) {
    const result = await this.client.cancel(input);
    await this.storage.upsertRequest(result);
    await this.storage.audit({
      type: Events.CANCELLED,
      accountId: result.accountId,
      syncRequestId: result.syncRequestId,
      status: result.status
    });
    this.eventBus?.emit?.(Events.CANCELLED, result);
    return result;
  }
}

module.exports = HistorySynchronizationManager;
