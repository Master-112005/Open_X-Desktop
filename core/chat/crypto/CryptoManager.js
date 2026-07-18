const AESManager = require('./AESManager');
const CryptoConfiguration = require('./CryptoConfiguration');
const CryptoLogger = require('./CryptoLogger');
const CryptoValidation = require('./CryptoValidation');
const HKDFManager = require('./HKDFManager');
const IdentityManager = require('./IdentityManager');
const KeyManager = require('./KeyManager');
const KeyRotationManager = require('./KeyRotationManager');
const RandomManager = require('./RandomManager');
const ReplayProtectionManager = require('./ReplayProtectionManager');
const SecureStorageManager = require('./SecureStorageManager');
const SessionManager = require('./SessionManager');

/**
 * Desktop Chat cryptographic composition root.
 */
class CryptoManager {
  /**
   * Creates a crypto manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.config = options.config instanceof CryptoConfiguration ? options.config : new CryptoConfiguration(options.config || {});
    this.logger = options.logger || new CryptoLogger();
    this.validation = options.validation || new CryptoValidation();
    this.random = options.random || new RandomManager();
    this.aes = options.aes || new AESManager({ config: this.config, random: this.random, validation: this.validation });
    this.hkdf = options.hkdf || new HKDFManager({ config: this.config });
    this.storage = options.storage || new SecureStorageManager({ config: this.config, aes: this.aes, random: this.random });
    this.keyManager = options.keyManager || new KeyManager({
      config: this.config,
      storage: this.storage,
      validation: this.validation,
      logger: this.logger
    });
    this.identity = options.identity || new IdentityManager({
      keyManager: this.keyManager,
      storage: this.storage,
      logger: this.logger
    });
    this.sessions = options.sessions || new SessionManager({
      config: this.config,
      random: this.random,
      logger: this.logger
    });
    this.replay = options.replay || new ReplayProtectionManager({
      config: this.config,
      logger: this.logger
    });
    this.rotation = options.rotation || new KeyRotationManager({
      keyManager: this.keyManager,
      logger: this.logger
    });
  }

  /**
   * Initializes crypto storage.
   */
  async initialize() {
    await this.storage.initialize();
  }
}

module.exports = CryptoManager;
