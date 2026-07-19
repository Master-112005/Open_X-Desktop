const { chatDataPath } = require('../ChatDataPaths');

/**
 * Configuration for trusted-device local history synchronization.
 */
class HistorySynchronizationConfiguration {
  /**
   * Creates configuration.
   * @param {object} options Overrides.
   */
  constructor(options = {}) {
    this.apiBaseUrl = String(options.apiBaseUrl || process.env.OPENX_CHAT_API_BASE_URL || 'https://openx-chat-server.onrender.com').replace(/\/+$/, '');
    this.storagePath = options.storagePath || chatDataPath('chat-history-sync.json', options);
    this.requestTimeoutMs = this.number(options.requestTimeoutMs, 15000);
    this.chunkSizeBytes = this.number(options.chunkSizeBytes, 262144);
    this.maxAuditEntries = this.number(options.maxAuditEntries, 500);
    this.maxTransferRecords = this.number(options.maxTransferRecords, 1000);
    this.validate();
    Object.freeze(this);
  }

  /**
   * Parses a number.
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
    if (!/^https?:\/\//i.test(this.apiBaseUrl)) throw new Error('History sync API base URL must be http:// or https://.');
    if (this.requestTimeoutMs < 1000) throw new Error('History sync request timeout is too small.');
    if (this.chunkSizeBytes < 4096) throw new Error('History sync chunk size is too small.');
  }
}

module.exports = HistorySynchronizationConfiguration;
