'use strict';

const crypto = require('crypto');
const EventEmitter = require('events');
const DeviceIdentity = require('./DeviceIdentity');
const IdentityRegistryClient = require('./contracts/IdentityRegistryClient');
const BLOCKCHAIN_EVENTS = require('./BlockchainEvents');
const {
  DEVICE_ID_PREFIX,
  DEVICE_ID_RANDOM_CHARS,
  DEVICE_TYPES,
  IDENTITY_STATUS,
  IDENTITY_VERSION
} = require('./IdentityConstants');
const {
  IdentityError,
  RegistrationError,
  VerificationError,
  RecoveryError,
  wrapBlockchainError
} = require('./BlockchainErrors');
const { retryOperation } = require('./utils/async');

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

class IdentityManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = options.config || {};
    this.identityConfig = this.config.identity || {};
    this.deviceType = normalizeDeviceType(this.identityConfig.deviceType || options.deviceType || 'desktop');
    this.walletManager = options.walletManager;
    this.identityStore = options.identityStore;
    this.registryClient = options.registryClient || new IdentityRegistryClient({
      address: this.identityConfig.registryAddress,
      client: options.client,
      logger: options.logger
    });
    this.logger = options.logger || console;
    this.identity = null;
  }

  async initialize(options = {}) {
    const identity = await this.loadIdentity();
    if (identity?.deviceId && identity?.walletAddress) {
      this.identity = identity;
      if (options.verify !== false && this.identityConfig.verifyOnStartup !== false) {
        await this.verifyIdentity().catch(error => {
          this.markFailed(error, 'startup-verification');
        });
      }
      return this.identity;
    }
    return this.generateIdentity();
  }

  async generateIdentity() {
    try {
      const walletStatus = await this.walletManager.ensureWallet();
      const identity = new DeviceIdentity({
        deviceId: generateDeviceId(this.deviceType),
        walletAddress: walletStatus.address,
        deviceType: this.deviceType,
        status: IDENTITY_STATUS.PENDING,
        network: this.config.network,
        version: IDENTITY_VERSION
      });
      this.identity = DeviceIdentity.normalize(await this.identityStore.save(identity.toJSON()), this.deviceType);
      this.emit(BLOCKCHAIN_EVENTS.IDENTITY_CREATED, this.identity.toJSON());
      return this.identity;
    } catch (error) {
      throw new RecoveryError('Unable to generate blockchain identity.', {
        code: 'BLOCKCHAIN_IDENTITY_GENERATION_FAILED',
        cause: error
      });
    }
  }

  async loadIdentity() {
    try {
      const stored = await this.identityStore.load();
      if (!stored) return null;
      this.identity = DeviceIdentity.normalize(stored, this.deviceType);
      return this.identity;
    } catch (error) {
      throw wrapBlockchainError(error, RecoveryError, { operation: 'loadIdentity' });
    }
  }

  async persistIdentity(identity) {
    const normalized = DeviceIdentity.normalize(identity, this.deviceType);
    this.identity = DeviceIdentity.normalize(await this.identityStore.save(normalized.toJSON()), this.deviceType);
    return this.identity;
  }

  async recoverIdentity() {
    const identity = await this.loadIdentity();
    if (identity?.deviceId && identity?.walletAddress) return identity;
    return this.generateIdentity();
  }

  async registerIdentity() {
    const identity = await this.ensureIdentity();
    if (!this.registryClient.isConfigured()) {
      return this.persistIdentity(identity.with({ status: IDENTITY_STATUS.PENDING }));
    }
    if (identity.status === IDENTITY_STATUS.REGISTERED && identity.transactionHash) return identity;

    const registering = await this.persistIdentity(identity.with({ status: IDENTITY_STATUS.REGISTERING }));
    this.logger.info?.('Blockchain identity registration started', {
      deviceId: registering.deviceId,
      walletAddress: registering.walletAddress,
      network: registering.network
    });

    try {
      const result = await retryOperation(() => this.registryClient.register(registering, this.walletManager.getSigner()), {
        attempts: this.identityConfig.registrationRetryAttempts,
        baseDelayMs: this.identityConfig.registrationRetryBaseDelayMs,
        maxDelayMs: this.identityConfig.registrationRetryMaxDelayMs
      });
      const registered = await this.persistIdentity(registering.with({
        registeredAt: result.registeredAt,
        status: IDENTITY_STATUS.REGISTERED,
        transactionHash: result.transactionHash,
        blockNumber: result.blockNumber,
        lastVerified: new Date().toISOString()
      }));
      this.emit(BLOCKCHAIN_EVENTS.IDENTITY_REGISTERED, registered.toJSON());
      return registered;
    } catch (error) {
      const failed = await this.persistIdentity(registering.with({ status: IDENTITY_STATUS.FAILED }));
      const wrapped = wrapBlockchainError(error, RegistrationError, { deviceId: failed.deviceId });
      this.emit(BLOCKCHAIN_EVENTS.IDENTITY_FAILED, wrapped.toJSON());
      throw wrapped;
    }
  }

  async verifyIdentity() {
    const identity = await this.ensureIdentity();
    if (!this.registryClient.isConfigured()) {
      return {
        valid: false,
        status: identity.status,
        reason: 'registry-not-configured',
        identity: identity.toJSON()
      };
    }
    try {
      const valid = await this.registryClient.verify(identity);
      const status = valid ? IDENTITY_STATUS.REGISTERED : IDENTITY_STATUS.FAILED;
      const updated = await this.persistIdentity(identity.with({
        status,
        lastVerified: new Date().toISOString()
      }));
      const result = { valid, status, identity: updated.toJSON() };
      this.emit(BLOCKCHAIN_EVENTS.IDENTITY_VERIFIED, result);
      return result;
    } catch (error) {
      const wrapped = wrapBlockchainError(error, VerificationError, { deviceId: identity.deviceId });
      this.emit(BLOCKCHAIN_EVENTS.IDENTITY_FAILED, wrapped.toJSON());
      throw wrapped;
    }
  }

  async identityExists() {
    const identity = await this.ensureIdentity();
    if (!this.registryClient.isConfigured()) return false;
    return this.registryClient.exists(identity.deviceId);
  }

  async getIdentity() {
    const identity = await this.ensureIdentity();
    return identity.toJSON();
  }

  async refreshIdentity() {
    const identity = await this.ensureIdentity();
    if (!this.registryClient.isConfigured()) {
      this.emit(BLOCKCHAIN_EVENTS.IDENTITY_REFRESHED, identity.toJSON());
      return identity.toJSON();
    }
    const record = await this.registryClient.get(identity.deviceId);
    const updated = await this.persistIdentity(identity.with({
      status: record.status || identity.status,
      registeredAt: record.registeredAt || identity.registeredAt,
      lastVerified: new Date().toISOString()
    }));
    this.emit(BLOCKCHAIN_EVENTS.IDENTITY_REFRESHED, updated.toJSON());
    return updated.toJSON();
  }

  async ensureIdentity() {
    if (this.identity?.deviceId && this.identity?.walletAddress) return this.identity;
    const loaded = await this.loadIdentity();
    if (loaded?.deviceId && loaded?.walletAddress) return loaded;
    return this.generateIdentity();
  }

  async synchronizeIdentity() {
    const identity = await this.ensureIdentity();
    if (this.identityConfig.autoRegister === false) return identity;
    try {
      return await this.registerIdentity();
    } catch (error) {
      this.markFailed(error, 'synchronize');
      return this.identity || identity;
    }
  }

  markFailed(error, operation) {
    const wrapped = wrapBlockchainError(error, IdentityError, { operation });
    this.logger.warn?.('Blockchain identity operation failed', wrapped.toJSON());
    this.emit(BLOCKCHAIN_EVENTS.IDENTITY_FAILED, wrapped.toJSON());
    return wrapped;
  }

  getStatus() {
    return {
      configured: Boolean(this.identityConfig.enabled !== false),
      registryConfigured: this.registryClient.isConfigured(),
      identity: this.identity?.toJSON?.() || null
    };
  }

  async shutdown() {
    this.removeAllListeners();
  }
}

function generateDeviceId(deviceType = DEVICE_TYPES.DESKTOP) {
  const type = normalizeDeviceType(deviceType).toUpperCase();
  return `${DEVICE_ID_PREFIX}-${type}-${randomCrockford(DEVICE_ID_RANDOM_CHARS)}`;
}

function randomCrockford(length) {
  const bytes = crypto.randomBytes(length);
  let output = '';
  for (const byte of bytes) output += CROCKFORD[byte % CROCKFORD.length];
  return output;
}

function normalizeDeviceType(value) {
  const candidate = String(value || '').trim().toLowerCase();
  return Object.values(DEVICE_TYPES).includes(candidate) ? candidate : DEVICE_TYPES.DESKTOP;
}

IdentityManager.generateDeviceId = generateDeviceId;
IdentityManager.normalizeDeviceType = normalizeDeviceType;

module.exports = IdentityManager;
