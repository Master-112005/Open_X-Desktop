const fs = require('fs/promises');
const path = require('path');

/**
 * Stores local history-sync coordination state inside OpenX_Data.
 */
class HistorySynchronizationStorage {
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
   * Initializes the local metadata store.
   */
  async initialize() {
    if (this.started) return;
    await fs.mkdir(path.dirname(this.config.storagePath), { recursive: true });
    try {
      this.state = this.normalize(JSON.parse(await fs.readFile(this.config.storagePath, 'utf8')));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.state = this.empty();
      await this.persist();
    }
    this.started = true;
  }

  /**
   * Creates the empty local state.
   * @returns {object} Empty state.
   */
  empty() {
    return {
      version: 1,
      requests: [],
      transfers: [],
      localSourceAvailability: [],
      audit: []
    };
  }

  /**
   * Normalizes loaded state.
   * @param {object} state Loaded state.
   * @returns {object} Normalized state.
   */
  normalize(state) {
    const empty = this.empty();
    return {
      version: Number(state?.version || 1),
      requests: Array.isArray(state?.requests) ? state.requests : empty.requests,
      transfers: Array.isArray(state?.transfers) ? state.transfers : empty.transfers,
      localSourceAvailability: Array.isArray(state?.localSourceAvailability) ? state.localSourceAvailability : empty.localSourceAvailability,
      audit: Array.isArray(state?.audit) ? state.audit : empty.audit
    };
  }

  /**
   * Upserts a server request metadata snapshot.
   * @param {object} request Request metadata.
   */
  async upsertRequest(request) {
    await this.initialize();
    const safe = this.sanitize(request);
    const index = this.state.requests.findIndex(item => item.syncRequestId === safe.syncRequestId);
    if (index >= 0) this.state.requests[index] = safe;
    else this.state.requests.push(safe);
    await this.persist();
  }

  /**
   * Upserts local transfer progress metadata.
   * @param {object} transfer Transfer metadata.
   */
  async upsertTransfer(transfer) {
    await this.initialize();
    const safe = this.sanitize(transfer);
    const index = this.state.transfers.findIndex(item => item.transferId === safe.transferId);
    if (index >= 0) this.state.transfers[index] = safe;
    else this.state.transfers.push(safe);
    this.state.transfers = this.state.transfers.slice(-this.config.maxTransferRecords);
    await this.persist();
  }

  /**
   * Records local source availability without exposing chat history.
   * @param {object} record Availability metadata.
   */
  async recordSourceAvailability(record) {
    await this.initialize();
    const safe = this.sanitize(record);
    const index = this.state.localSourceAvailability.findIndex(item => item.accountId === safe.accountId && item.deviceId === safe.deviceId);
    if (index >= 0) this.state.localSourceAvailability[index] = safe;
    else this.state.localSourceAvailability.push(safe);
    await this.persist();
  }

  /**
   * Adds a privacy-safe audit event.
   * @param {object} event Audit event.
   */
  async audit(event) {
    await this.initialize();
    this.state.audit.push({
      ...this.sanitize(event),
      createdAt: event.createdAt || new Date().toISOString()
    });
    this.state.audit = this.state.audit.slice(-this.config.maxAuditEntries);
    await this.persist();
  }

  /**
   * Removes unsafe local chat fields from persisted sync metadata.
   * @param {*} value Candidate value.
   * @returns {*} Sanitized value.
   */
  sanitize(value) {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map(item => this.sanitize(item));
    if (typeof value !== 'object') return value;
    const forbidden = /^(text|body|content|plaintext|message|messages|conversationHistory|conversationIndex|searchIndex|pinnedChats|archivedChats|mutedChats|deletedChats|nicknames)$/i;
    const output = {};
    for (const [key, child] of Object.entries(value)) {
      if (forbidden.test(key)) continue;
      output[key] = this.sanitize(child);
    }
    return output;
  }

  /**
   * Persists local metadata.
   */
  async persist() {
    const payload = JSON.stringify(this.state, null, 2);
    this.writeQueue = this.writeQueue.then(() => fs.writeFile(this.config.storagePath, payload));
    await this.writeQueue;
  }
}

module.exports = HistorySynchronizationStorage;
