const crypto = require('crypto');

/**
 * Coordinates client-local encrypted history transfer progress.
 * Raw chat records must be encrypted by the caller before entering this engine.
 */
class HistoryTransferEngine {
  /**
   * Creates transfer engine.
   * @param {object} options Engine dependencies.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.storage = options.storage;
    this.eventBus = options.eventBus;
  }

  /**
   * Creates an encrypted export manifest without storing chat content.
   * @param {object} input Export input.
   * @returns {object} Safe manifest summary.
   */
  createEncryptedExportManifest(input = {}) {
    return {
      exportId: this.id('hexport'),
      accountId: String(input.accountId || ''),
      deviceId: String(input.deviceId || ''),
      encryptionVersion: String(input.encryptionVersion || 'client-managed-e2ee'),
      historySchemaVersion: Number(input.historySchemaVersion || 1),
      estimatedRecords: this.number(input.estimatedRecords),
      estimatedBytes: this.number(input.estimatedBytes),
      highestSequence: this.number(input.highestSequence),
      localRevision: this.number(input.localRevision),
      tableCount: this.number(input.tableCount),
      integrityHash: input.integrityHash ? String(input.integrityHash).slice(0, 160) : null,
      createdAt: new Date().toISOString(),
      containsPlaintext: false
    };
  }

  /**
   * Starts local transfer progress.
   * @param {object} transfer Transfer metadata.
   * @returns {Promise<object>} Progress metadata.
   */
  async startTransfer(transfer = {}) {
    const record = {
      transferId: transfer.transferId || this.id('hlocaltransfer'),
      syncRequestId: transfer.syncRequestId || null,
      sourceDeviceId: transfer.sourceDeviceId || null,
      targetDeviceId: transfer.targetDeviceId || null,
      status: 'InProgress',
      encryptedBytes: 0,
      chunkCount: 0,
      chunkSizeBytes: Number(transfer.chunkSizeBytes || this.config.chunkSizeBytes),
      historyStoredOnServer: false,
      serverCanDecrypt: false,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await this.storage.upsertTransfer(record);
    this.eventBus?.emit?.('chat.historySync.transferProgress', record);
    return record;
  }

  /**
   * Records an encrypted chunk transfer.
   * @param {object} input Chunk metadata.
   * @returns {Promise<object>} Updated progress.
   */
  async recordEncryptedChunk(input = {}) {
    this.assertEncryptedChunk(input);
    const record = {
      transferId: input.transferId,
      syncRequestId: input.syncRequestId || null,
      status: 'InProgress',
      encryptedBytes: this.number(input.encryptedBytes),
      chunkCount: this.number(input.chunkIndex) + 1,
      lastChunkHash: String(input.chunkHash || '').slice(0, 160),
      historyStoredOnServer: false,
      serverCanDecrypt: false,
      updatedAt: new Date().toISOString()
    };
    await this.storage.upsertTransfer(record);
    this.eventBus?.emit?.('chat.historySync.transferProgress', record);
    return record;
  }

  /**
   * Completes transfer progress.
   * @param {object} input Completion metadata.
   * @returns {Promise<object>} Completed transfer metadata.
   */
  async completeTransfer(input = {}) {
    const record = {
      transferId: input.transferId,
      syncRequestId: input.syncRequestId || null,
      status: 'Completed',
      encryptedBytes: this.number(input.encryptedBytes),
      chunkCount: this.number(input.chunkCount),
      integrityHash: input.integrityHash ? String(input.integrityHash).slice(0, 160) : null,
      verified: input.verified !== false,
      historyStoredOnServer: false,
      serverCanDecrypt: false,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await this.storage.upsertTransfer(record);
    this.eventBus?.emit?.('chat.historySync.completed', record);
    return record;
  }

  /**
   * Validates encrypted chunk metadata.
   * @param {object} input Chunk input.
   */
  assertEncryptedChunk(input) {
    if (!input || typeof input !== 'object') throw new Error('Encrypted history chunk metadata is required.');
    if (!String(input.transferId || '').trim()) throw new Error('TransferID is required for encrypted history chunk.');
    if (!String(input.chunkHash || '').trim()) throw new Error('Encrypted history chunk hash is required.');
    if (Object.prototype.hasOwnProperty.call(input, 'plaintext') || Object.prototype.hasOwnProperty.call(input, 'text') || Object.prototype.hasOwnProperty.call(input, 'message')) {
      throw new Error('History transfer engine accepts encrypted chunks only.');
    }
  }

  /**
   * Converts a value to a safe number.
   * @param {*} value Value.
   * @returns {number} Number.
   */
  number(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
  }

  /**
   * Generates an opaque local id.
   * @param {string} prefix Prefix.
   * @returns {string} Opaque id.
   */
  id(prefix) {
    return `${prefix}_${crypto.randomBytes(16).toString('hex')}`;
  }
}

module.exports = HistoryTransferEngine;
