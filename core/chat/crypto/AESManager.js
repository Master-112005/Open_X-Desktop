const crypto = require('crypto');
const CryptoError = require('./CryptoErrors');

/**
 * AES-256-GCM encryption/decryption manager.
 */
class AESManager {
  /**
   * Creates an AES manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.random = options.random;
    this.validation = options.validation;
  }

  /**
   * Encrypts data using AES-256-GCM.
   * @param {object} input Encryption input.
   * @returns {object} Encryption envelope.
   */
  encrypt(input) {
    const key = this.validation.buffer(input.key, this.config.keySizeBytes, 'AES key');
    const iv = input.iv ? this.validation.buffer(input.iv, this.config.ivSizeBytes, 'AES IV') : this.random.iv();
    const cipher = crypto.createCipheriv(this.config.aesAlgorithm, key, iv, { authTagLength: this.config.tagSizeBytes });
    if (input.aad) cipher.setAAD(Buffer.from(input.aad));
    const ciphertext = Buffer.concat([cipher.update(Buffer.from(input.plaintext)), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      algorithm: this.config.aesAlgorithm,
      iv: iv.toString('base64url'),
      ciphertext: ciphertext.toString('base64url'),
      tag: tag.toString('base64url'),
      aad: input.aad ? Buffer.from(input.aad).toString('base64url') : null,
      futureStreaming: false
    };
  }

  /**
   * Decrypts an AES-256-GCM envelope.
   * @param {object} input Decryption input.
   * @returns {Buffer} Plaintext.
   */
  decrypt(input) {
    try {
      const key = this.validation.buffer(input.key, this.config.keySizeBytes, 'AES key');
      const iv = this.validation.buffer(Buffer.from(input.iv, 'base64url'), this.config.ivSizeBytes, 'AES IV');
      const tag = this.validation.buffer(Buffer.from(input.tag, 'base64url'), this.config.tagSizeBytes, 'AES tag');
      const decipher = crypto.createDecipheriv(this.config.aesAlgorithm, key, iv, { authTagLength: this.config.tagSizeBytes });
      if (input.aad) decipher.setAAD(Buffer.from(input.aad, 'base64url'));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(Buffer.from(input.ciphertext, 'base64url')), decipher.final()]);
    } catch (error) {
      throw new CryptoError('crypto.auth_failed', 'AES-GCM authentication failed.');
    }
  }
}

module.exports = AESManager;
