const crypto = require('crypto');

/**
 * Centralized cryptographically secure random manager.
 */
class RandomManager {
  /**
   * Generates random bytes.
   * @param {number} size Number of bytes.
   * @returns {Buffer} Random bytes.
   */
  bytes(size) {
    return crypto.randomBytes(size);
  }

  /** @returns {Buffer} AES-256 key bytes. */
  key() { return this.bytes(32); }

  /** @returns {Buffer} AES-GCM IV bytes. */
  iv() { return this.bytes(12); }

  /** @returns {Buffer} Nonce bytes. */
  nonce() { return this.bytes(24); }

  /** @returns {Buffer} Salt bytes. */
  salt() { return this.bytes(32); }

  /** @returns {string} Session id. */
  sessionId() { return `sess_${this.bytes(24).toString('hex')}`; }

  /** @returns {string} Token id. */
  tokenId() { return `tok_${this.bytes(24).toString('hex')}`; }
}

module.exports = RandomManager;
