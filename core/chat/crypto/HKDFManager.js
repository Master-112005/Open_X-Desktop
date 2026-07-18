const crypto = require('crypto');

/**
 * HKDF-SHA256 derivation manager with domain separation.
 */
class HKDFManager {
  /**
   * Creates an HKDF manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.config = options.config;
  }

  /**
   * Derives key material using HKDF-SHA256.
   * @param {object} input Derivation input.
   * @returns {Buffer} Derived key.
   */
  derive(input) {
    const key = crypto.hkdfSync(
      this.config.hkdfHash,
      Buffer.from(input.ikm),
      Buffer.from(input.salt),
      Buffer.from(input.info),
      Number(input.length || this.config.keySizeBytes)
    );
    return Buffer.from(key);
  }

  /**
   * Derives a domain-separated subkey.
   * @param {object} input Subkey input.
   * @returns {Buffer} Subkey.
   */
  subkey(input) {
    const context = `OpenXChat:v${input.version || 1}:${input.context}`;
    return this.derive({
      ikm: input.rootKey,
      salt: input.salt,
      info: context,
      length: input.length || this.config.keySizeBytes
    });
  }
}

module.exports = HKDFManager;
