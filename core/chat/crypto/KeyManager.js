const crypto = require('crypto');

/**
 * Generates and stores local identity and device key pairs.
 */
class KeyManager {
  /**
   * Creates a key manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.storage = options.storage;
    this.validation = options.validation;
    this.logger = options.logger;
  }

  /**
   * Generates an identity key pair.
   * @returns {object} Key pair.
   */
  generateIdentityKeyPair() {
    return this.generateKeyPair('identity', this.config.identityKeyAlgorithm);
  }

  /**
   * Generates a device key pair.
   * @returns {object} Key pair.
   */
  generateDeviceKeyPair() {
    return this.generateKeyPair('device', this.config.deviceKeyAlgorithm);
  }

  /**
   * Generates a public/private key pair.
   * @param {string} keyType Key type.
   * @param {string} algorithm Algorithm.
   * @returns {object} Key pair.
   */
  generateKeyPair(keyType, algorithm) {
    const pair = crypto.generateKeyPairSync(algorithm);
    const publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' });
    const privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
    const fingerprint = this.fingerprint(publicKey);
    this.logger.info('Crypto key pair generated', { keyType, algorithm, fingerprint });
    return {
      keyType,
      algorithm,
      publicKey,
      privateKey,
      fingerprint,
      createdAt: new Date().toISOString(),
      keyVersion: 1
    };
  }

  /**
   * Stores private key locally.
   * @param {string} name Secret name.
   * @param {object} keyPair Key pair.
   */
  async storePrivateKey(name, keyPair) {
    await this.storage.setSecret(name, {
      keyType: keyPair.keyType,
      algorithm: keyPair.algorithm,
      privateKey: this.validation.privateKeyPem(keyPair.privateKey),
      publicKey: this.validation.publicKeyPem(keyPair.publicKey),
      fingerprint: keyPair.fingerprint,
      keyVersion: keyPair.keyVersion,
      createdAt: keyPair.createdAt
    });
  }

  /**
   * Reads private key locally.
   * @param {string} name Secret name.
   * @returns {Promise<object|null>} Stored key pair.
   */
  getPrivateKey(name) {
    return this.storage.getSecret(name);
  }

  /**
   * Generates a stable public key fingerprint.
   * @param {string} publicKey Public key PEM.
   * @returns {string} Fingerprint.
   */
  fingerprint(publicKey) {
    const digest = crypto.createHash('sha256').update(this.validation.publicKeyPem(publicKey)).digest('hex');
    return `fp:v1:sha256:${digest}`;
  }
}

module.exports = KeyManager;
