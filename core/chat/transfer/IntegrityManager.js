const crypto = require('crypto');

/**
 * Desktop transfer integrity manager.
 */
class IntegrityManager {
  /**
   * Computes SHA-256.
   * @param {Buffer|Uint8Array|string} value Bytes.
   * @returns {string} Hex digest.
   */
  sha256(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /**
   * Verifies SHA-256.
   * @param {Buffer|Uint8Array|string} value Bytes.
   * @param {string} expectedHash Expected hash.
   * @returns {boolean} True when verified.
   */
  verify(value, expectedHash) {
    const actual = this.sha256(value);
    if (actual !== String(expectedHash || '').toLowerCase()) throw new Error('File integrity verification failed.');
    return true;
  }
}

module.exports = IntegrityManager;
