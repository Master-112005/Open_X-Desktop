/**
 * Manages local key rotation metadata.
 */
class KeyRotationManager {
  /**
   * Creates a key rotation manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.keyManager = options.keyManager;
    this.logger = options.logger;
    this.history = [];
  }

  /**
   * Rotates a key pair manually.
   * @param {object} input Rotation input.
   * @returns {Promise<object>} New key pair public metadata.
   */
  async rotate(input) {
    const keyPair = input.keyType === 'device'
      ? this.keyManager.generateDeviceKeyPair()
      : this.keyManager.generateIdentityKeyPair();
    keyPair.keyVersion = Number(input.currentVersion || 1) + 1;
    await this.keyManager.storePrivateKey(`${input.keyType}:${input.ownerId}`, keyPair);
    const rotation = {
      ownerId: input.ownerId,
      keyType: input.keyType,
      previousFingerprint: input.previousFingerprint || null,
      fingerprint: keyPair.fingerprint,
      keyVersion: keyPair.keyVersion,
      reason: input.reason || 'manual',
      rotatedAt: new Date().toISOString(),
      futureMigration: null
    };
    this.history.push(rotation);
    this.logger.info('Crypto key rotated', { ownerId: input.ownerId, keyType: input.keyType, fingerprint: keyPair.fingerprint });
    return {
      ...rotation,
      publicKey: keyPair.publicKey,
      algorithm: keyPair.algorithm
    };
  }
}

module.exports = KeyRotationManager;
