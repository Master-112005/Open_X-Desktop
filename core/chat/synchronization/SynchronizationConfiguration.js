const os = require('os');
const path = require('path');

/**
 * Desktop reliable synchronization configuration.
 */
class SynchronizationConfiguration {
  /**
   * Creates sync configuration.
   * @param {object} options Overrides.
   */
  constructor(options = {}) {
    this.apiBaseUrl = String(options.apiBaseUrl || process.env.OPENX_CHAT_API_URL || 'http://localhost:8090').replace(/\/+$/, '');
    this.requestTimeoutMs = Number(options.requestTimeoutMs || 15000);
    this.maxFetchLimit = Number(options.maxFetchLimit || 100);
    this.maxRetries = Number(options.maxRetries || 5);
    this.retryBaseDelayMs = Number(options.retryBaseDelayMs || 1000);
    this.retryMaxDelayMs = Number(options.retryMaxDelayMs || 60000);
    this.storagePath = options.storagePath || path.join(os.homedir(), 'Documents', 'OpenX_Data', 'chat-sync-cursors.json');
    this.validate();
    Object.freeze(this);
  }

  /**
   * Validates configuration.
   */
  validate() {
    if (!/^https?:\/\//i.test(this.apiBaseUrl)) throw new Error('Sync API URL must be http:// or https://.');
    if (this.requestTimeoutMs < 1000) throw new Error('Sync request timeout is too small.');
    if (this.maxFetchLimit < 1) throw new Error('Sync fetch limit must be positive.');
    if (this.retryMaxDelayMs < this.retryBaseDelayMs) throw new Error('Sync retry max delay must be >= base delay.');
  }
}

module.exports = SynchronizationConfiguration;
