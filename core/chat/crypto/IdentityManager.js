/**
 * Manages local account identity keys.
 */
class IdentityManager {
  /**
   * Creates an identity manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.keyManager = options.keyManager;
    this.storage = options.storage;
    this.logger = options.logger;
  }

  /**
   * Generates and stores a long-term account identity key.
   * @param {string} accountId AccountID.
   * @returns {Promise<object>} Public identity.
   */
  async generateIdentity(accountId) {
    const keyPair = this.keyManager.generateIdentityKeyPair();
    await this.keyManager.storePrivateKey(`identity:${accountId}`, keyPair);
    const publicIdentity = this.exportPublicIdentity(accountId, keyPair);
    this.logger.info('Identity key generated', { accountId, fingerprint: publicIdentity.fingerprint });
    return publicIdentity;
  }

  /**
   * Exports public identity data only.
   * @param {string} accountId AccountID.
   * @param {object} keyPair Key pair.
   * @returns {object} Public identity.
   */
  exportPublicIdentity(accountId, keyPair) {
    return {
      accountId,
      keyType: 'identity',
      publicKey: keyPair.publicKey,
      fingerprint: keyPair.fingerprint,
      algorithm: keyPair.algorithm,
      keyVersion: keyPair.keyVersion,
      metadata: {
        generatedAt: keyPair.createdAt
      }
    };
  }

  /**
   * Imports a remote public identity.
   * @param {object} identity Public identity.
   * @returns {object} Public identity.
   */
  importPublicIdentity(identity) {
    const fingerprint = this.keyManager.fingerprint(identity.publicKey);
    if (fingerprint !== identity.fingerprint) throw new Error('Identity fingerprint mismatch.');
    return { ...identity, importedAt: new Date().toISOString() };
  }

  /**
   * Verifies public identity fingerprint.
   * @param {object} identity Public identity.
   * @returns {boolean} Whether valid.
   */
  verifyIdentity(identity) {
    return this.keyManager.fingerprint(identity.publicKey) === identity.fingerprint;
  }
}

module.exports = IdentityManager;
