const os = require('os');
const path = require('path');

/**
 * Desktop Phase 10 multi-device configuration.
 */
class MultiDeviceConfiguration {
  /**
   * Creates configuration.
   * @param {object} options Overrides.
   */
  constructor(options = {}) {
    this.apiBaseUrl = String(options.apiBaseUrl || process.env.OPENX_CHAT_API_URL || 'http://localhost:8090').replace(/\/+$/, '');
    this.requestTimeoutMs = Number(options.requestTimeoutMs || 15000);
    this.maxRetries = Number(options.maxRetries || 5);
    this.storagePath = options.storagePath || path.join(os.homedir(), 'Documents', 'OpenX_Data', 'chat-multi-device.json');
    this.validate();
    Object.freeze(this);
  }

  /**
   * Validates configuration.
   */
  validate() {
    if (!/^https?:\/\//i.test(this.apiBaseUrl)) throw new Error('Multi-device API URL must be http:// or https://.');
    if (this.requestTimeoutMs < 1000) throw new Error('Multi-device request timeout is too small.');
    if (this.maxRetries < 0) throw new Error('Multi-device max retries must be >= 0.');
  }
}

module.exports = MultiDeviceConfiguration;
