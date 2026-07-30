const crypto = require('crypto');
const { readSecureJsonFile, writeSecureJsonAtomic } = require('../../assistant/Data');
const CryptoError = require('./CryptoErrors');

/**
 * Encrypted local storage for private keys and future session keys.
 */
class SecureStorageManager {
  /**
   * Creates a secure storage manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.aes = options.aes;
    this.random = options.random;
    this.backend = this.config.storageBackend;
    this.state = { version: 1, entries: {} };
    this.memoryKey = this.config.storageSecret
      ? crypto.createHash('sha256').update(this.config.storageSecret).digest()
      : this.random.key();
  }

  /**
   * Initializes storage.
   */
  async initialize() {
    if (this.backend) return;
    try {
      this.state = readSecureJsonFile(this.config.storagePath, () => this.state, {
        createIfMissing: true,
        validate: value => value && typeof value === 'object' && value.entries && typeof value.entries === 'object'
      });
    } catch (error) {
      throw new CryptoError('crypto.storage_failed', 'Secure storage could not be read.');
    }
  }

  /**
   * Stores a secret encrypted at rest.
   * @param {string} name Secret name.
   * @param {*} value Secret value.
   */
  async setSecret(name, value) {
    if (this.backend?.setSecret) return this.backend.setSecret(name, value);
    const envelope = this.aes.encrypt({
      key: this.memoryKey,
      plaintext: Buffer.from(JSON.stringify(value), 'utf8'),
      aad: Buffer.from(`openx-chat:${name}`)
    });
    this.state.entries[name] = { ...envelope, updatedAt: new Date().toISOString() };
    await this.persist();
  }

  /**
   * Reads and decrypts a secret.
   * @param {string} name Secret name.
   * @returns {Promise<*>} Secret value.
   */
  async getSecret(name) {
    if (this.backend?.getSecret) return this.backend.getSecret(name);
    const entry = this.state.entries[name];
    if (!entry) return null;
    const plaintext = this.aes.decrypt({
      key: this.memoryKey,
      iv: entry.iv,
      ciphertext: entry.ciphertext,
      tag: entry.tag,
      aad: Buffer.from(`openx-chat:${name}`).toString('base64url')
    });
    return JSON.parse(plaintext.toString('utf8'));
  }

  /**
   * Deletes a secret.
   * @param {string} name Secret name.
   */
  async deleteSecret(name) {
    if (this.backend?.deleteSecret) return this.backend.deleteSecret(name);
    delete this.state.entries[name];
    await this.persist();
  }

  /**
   * Lists stored secret names.
   * @returns {string[]} Secret names.
   */
  listKeys() {
    if (this.backend?.listKeys) return this.backend.listKeys();
    return Object.keys(this.state.entries);
  }

  /**
   * Persists encrypted state.
   */
  async persist() {
    writeSecureJsonAtomic(this.config.storagePath, this.state, { backup: true });
  }
}

module.exports = SecureStorageManager;
