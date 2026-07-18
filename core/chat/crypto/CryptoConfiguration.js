const os = require('os');
const path = require('path');

/**
 * Desktop crypto configuration.
 */
class CryptoConfiguration {
  /**
   * Creates crypto configuration.
   * @param {object} options Overrides.
   */
  constructor(options = {}) {
    this.aesAlgorithm = options.aesAlgorithm || 'aes-256-gcm';
    this.keySizeBytes = Number(options.keySizeBytes || 32);
    this.ivSizeBytes = Number(options.ivSizeBytes || 12);
    this.tagSizeBytes = Number(options.tagSizeBytes || 16);
    this.hkdfHash = options.hkdfHash || 'sha256';
    this.replayWindowMs = Number(options.replayWindowMs || 300000);
    this.sessionTtlMs = Number(options.sessionTtlMs || 3600000);
    this.rotationIntervalMs = Number(options.rotationIntervalMs || 2592000000);
    this.identityKeyAlgorithm = options.identityKeyAlgorithm || 'ed25519';
    this.deviceKeyAlgorithm = options.deviceKeyAlgorithm || 'ed25519';
    this.storagePath = options.storagePath || path.join(os.homedir(), 'Documents', 'OpenX_Data', 'chat-crypto-secrets.json');
    this.storageSecret = options.storageSecret || process.env.OPENX_CHAT_CRYPTO_STORAGE_SECRET || null;
    this.storageBackend = options.storageBackend || null;
    this.validate();
    Object.freeze(this);
  }

  /**
   * Validates configuration.
   */
  validate() {
    if (this.aesAlgorithm !== 'aes-256-gcm') throw new Error('Only AES-256-GCM is enabled.');
    if (this.keySizeBytes !== 32) throw new Error('AES-256-GCM requires 32-byte keys.');
    if (this.ivSizeBytes !== 12) throw new Error('AES-GCM IV size must be 12 bytes.');
    if (this.tagSizeBytes !== 16) throw new Error('AES-GCM tag size must be 16 bytes.');
    if (this.hkdfHash !== 'sha256') throw new Error('Only HKDF-SHA256 is enabled.');
  }
}

module.exports = CryptoConfiguration;
