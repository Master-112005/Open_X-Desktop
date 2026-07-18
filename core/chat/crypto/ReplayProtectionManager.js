const CryptoError = require('./CryptoErrors');

/**
 * Replay protection manager for nonces and future message identifiers.
 */
class ReplayProtectionManager {
  /**
   * Creates replay protection.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.logger = options.logger;
    this.cache = new Map();
  }

  /**
   * Validates and records a nonce.
   * @param {string} nonce Nonce.
   * @returns {boolean} True when accepted.
   */
  validateNonce(nonce) {
    const value = String(nonce || '').trim();
    if (!value) throw new CryptoError('crypto.nonce_invalid', 'Nonce is required.');
    this.cleanup();
    if (this.cache.has(value)) {
      this.logger.warn('Replay detected', { nonce: value });
      throw new CryptoError('crypto.replay_detected', 'Replay detected.');
    }
    this.cache.set(value, Date.now() + this.config.replayWindowMs);
    return true;
  }

  /**
   * Removes expired nonce entries.
   */
  cleanup() {
    const now = Date.now();
    for (const [nonce, expiresAt] of this.cache.entries()) {
      if (now >= expiresAt) this.cache.delete(nonce);
    }
  }
}

module.exports = ReplayProtectionManager;
