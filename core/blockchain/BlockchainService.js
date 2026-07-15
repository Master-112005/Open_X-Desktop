'use strict';

const EventEmitter = require('events');
const ConfigManager = require('./ConfigManager');
const AvalancheClient = require('./AvalancheClient');
const NetworkManager = require('./NetworkManager');
const WalletManager = require('./WalletManager');
const IdentityManager = require('./IdentityManager');
const BlockchainPairManager = require('./BlockchainPairManager');
const DeviceTrustEngine = require('./DeviceTrustEngine');
const TrustManager = require('./TrustManager');
const PermissionManager = require('./PermissionManager');
const LocalIdentityStore = require('./LocalIdentityStore');
const LocalPairStore = require('./LocalPairStore');
const TrustCache = require('./TrustCache');
const PermissionCache = require('./PermissionCache');
const SecureWalletStore = require('./SecureWalletStore');
const BlockchainHealth = require('./BlockchainHealth');
const BlockchainLogger = require('./BlockchainLogger');
const BLOCKCHAIN_EVENTS = require('./BlockchainEvents');
const { BLOCKCHAIN_STATES } = require('./BlockchainConstants');
const { wrapBlockchainError, BlockchainError } = require('./BlockchainErrors');

class BlockchainService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.configManager = options.configManager || new ConfigManager({
      config: options.config || {},
      env: options.env
    });
    this.logger = options.logger instanceof BlockchainLogger
      ? options.logger
      : new BlockchainLogger({ logger: options.logger || console, level: options.logLevel || 'info' });
    this.ClientClass = options.ClientClass || AvalancheClient;
    this.NetworkManagerClass = options.NetworkManagerClass || NetworkManager;
    this.WalletManagerClass = options.WalletManagerClass || WalletManager;
    this.IdentityManagerClass = options.IdentityManagerClass || IdentityManager;
    this.PairManagerClass = options.PairManagerClass || BlockchainPairManager;
    this.TrustManagerClass = options.TrustManagerClass || TrustManager;
    this.DeviceTrustEngineClass = options.DeviceTrustEngineClass || DeviceTrustEngine;
    this.PermissionManagerClass = options.PermissionManagerClass || PermissionManager;
    this.health = options.health || new BlockchainHealth();
    this.client = options.client || null;
    this.networkManager = options.networkManager || null;
    this.walletManager = options.walletManager || null;
    this.identityManager = options.identityManager || null;
    this.pairManager = options.pairManager || null;
    this.trustManager = options.trustManager || null;
    this.trustEngine = options.trustEngine || null;
    this.permissionManager = options.permissionManager || null;
    this.identityStore = options.identityStore || null;
    this.pairStore = options.pairStore || null;
    this.trustCache = options.trustCache || null;
    this.permissionCache = options.permissionCache || null;
    this.walletSecureStore = options.walletSecureStore || null;
    this.contractRegistry = Object.freeze({});
    this.config = null;
    this.state = BLOCKCHAIN_STATES.STOPPED;
    this.initialized = false;
    this.startedAt = 0;
    this.lastError = null;
    this.identityEventsBound = false;
    this.trustEventsBound = false;
    this.permissionEventsBound = false;
  }

  async initialize(overrides = {}) {
    this.config = this.configManager.getConfig(overrides);
    this.health.start();
    this.startedAt = this.startedAt || Date.now();
    await this.initializeLocalIdentity({ verify: false }).catch(error => {
      this.lastError = wrapBlockchainError(error, BlockchainError, { operation: 'initializeLocalIdentity' });
      this.logger.warn('Blockchain identity initialization failed; OpenX will continue', this.lastError.toJSON());
      this.emit(BLOCKCHAIN_EVENTS.IDENTITY_FAILED, this.lastError.toJSON());
      return null;
    });

    if (!this.config.enabled) {
      this.state = BLOCKCHAIN_STATES.STOPPED;
      this.initialized = false;
      this.logger.info('Blockchain service disabled by configuration', {
        network: this.config.network
      });
      return this.getStatus();
    }

    this.state = BLOCKCHAIN_STATES.INITIALIZING;
    this.logger.info('Blockchain service initializing', {
      network: this.config.network,
      chainId: this.config.chainId
    });

    try {
      this.client = this.client || new this.ClientClass({
        config: this.config,
        logger: this.logger.child({ component: 'avalanche-client' })
      });
      this.bindClientEvents(this.client);
      await this.client.connect();
      this.networkManager = this.networkManager || new this.NetworkManagerClass({
        client: this.client,
        config: this.config,
        logger: this.logger.child({ component: 'network-manager' }),
        health: this.health
      });
      this.bindNetworkEvents(this.networkManager);
      await this.networkManager.validateRPC();
      this.networkManager.startHealthMonitoring?.();
      await this.initializeLocalIdentity({ client: this.client });
      await this.synchronizeIdentitySafely();
      this.state = BLOCKCHAIN_STATES.INITIALIZED;
      this.initialized = true;
      this.lastError = null;
      const status = this.getStatus();
      this.emit(BLOCKCHAIN_EVENTS.INITIALIZED, status);
      return status;
    } catch (error) {
      const wrapped = wrapBlockchainError(error, BlockchainError, { network: this.config.network });
      this.state = BLOCKCHAIN_STATES.ERROR;
      this.initialized = false;
      this.lastError = wrapped;
      this.health.recordHealth({ connected: false, healthy: false, error: wrapped.message });
      this.logger.warn('Blockchain initialization failed; OpenX will continue without blockchain', wrapped.toJSON());
      this.emit(BLOCKCHAIN_EVENTS.ERROR, wrapped.toJSON());
      return this.getStatus();
    }
  }

  async shutdown(reason = 'shutdown') {
    this.networkManager?.stopHealthMonitoring?.();
    await this.networkManager?.shutdown?.();
    await this.identityManager?.shutdown?.();
    await this.pairManager?.shutdown?.();
    await this.trustEngine?.shutdown?.();
    await this.trustManager?.shutdown?.();
    await this.permissionManager?.shutdown?.();
    await this.walletManager?.shutdown?.();
    await this.client?.disconnect?.(reason);
    this.networkManager = null;
    this.identityManager = null;
    this.pairManager = null;
    this.trustEngine = null;
    this.trustManager = null;
    this.permissionManager = null;
    this.walletManager = null;
    this.identityEventsBound = false;
    this.trustEventsBound = false;
    this.permissionEventsBound = false;
    this.client = null;
    this.state = BLOCKCHAIN_STATES.STOPPED;
    this.initialized = false;
    this.health.stop();
    this.removeAllListeners();
    return this.getStatus();
  }

  async healthCheck() {
    if (!this.config?.enabled || !this.networkManager) return this.health.snapshot();
    return this.networkManager.healthCheck();
  }

  async isConnected() {
    return this.health.isConnected();
  }

  async isHealthy() {
    return this.health.isHealthy();
  }

  async getCurrentBlock() {
    if (!this.client) return null;
    const blockNumber = await this.client.getBlockNumber();
    this.health.recordHealth({
      connected: true,
      healthy: true,
      blockNumber,
      lastSyncAt: new Date().toISOString()
    });
    return blockNumber;
  }

  async getCurrentNetwork() {
    if (!this.client) return null;
    return this.client.getNetwork();
  }

  getProviderAccess() {
    return this.client?.getProviderAccess?.() || null;
  }

  getWalletAccess() {
    return this.walletManager?.getWalletAccess?.() || null;
  }

  getContractAccess() {
    return this.contractRegistry;
  }

  async registerIdentity() {
    return (await this.ensureIdentityManager()).registerIdentity();
  }

  async verifyIdentity() {
    return (await this.ensureIdentityManager()).verifyIdentity();
  }

  async loadIdentity() {
    return (await this.ensureIdentityManager()).loadIdentity();
  }

  async identityExists() {
    return (await this.ensureIdentityManager()).identityExists();
  }

  async getIdentity() {
    return (await this.ensureIdentityManager()).getIdentity();
  }

  async refreshIdentity() {
    return (await this.ensureIdentityManager()).refreshIdentity();
  }

  async createPair(options = {}) {
    return (await this.ensurePairManager()).createPair(options);
  }

  async approvePair(options = {}) {
    return (await this.ensurePairManager()).approvePair(options);
  }

  async rejectPair(pairHash) {
    return (await this.ensurePairManager()).rejectPair(pairHash);
  }

  async revokePair(pairHash) {
    return (await this.ensurePairManager()).revokePair(pairHash);
  }

  async verifyPair(payload = {}) {
    return (await this.ensurePairManager()).verifyPair(payload);
  }

  async pairExists(pairHash) {
    return (await this.ensurePairManager()).pairExists(pairHash);
  }

  async getPair(pairHash) {
    return (await this.ensurePairManager()).getPair(pairHash);
  }

  async refreshPair(pairHash) {
    return (await this.ensurePairManager()).refreshPair(pairHash);
  }

  checkTrust(input = {}) {
    if (!this.trustEngine) return {
      decision: 'ALLOW',
      allowed: true,
      trustStatus: 'UNKNOWN',
      reason: 'trust-engine-not-initialized',
      trust: null
    };
    return this.trustEngine.checkTrust(input);
  }

  async refreshTrust(input = {}) {
    return (await this.ensureTrustEngine()).refreshTrust(input);
  }

  async verifyTrust(input = {}) {
    return (await this.ensureTrustEngine()).verifyTrust(input);
  }

  async loadTrust() {
    await this.ensureTrustEngine();
    return this.trustManager.loadTrust();
  }

  async cacheTrust(record) {
    await this.ensureTrustEngine();
    return this.trustManager.cacheTrust(record);
  }

  async invalidateTrust(deviceId) {
    await this.ensureTrustEngine();
    return this.trustManager.invalidateTrust(deviceId);
  }

  async grantPermission(record = {}) {
    return (await this.ensurePermissionManager()).grantPermission(record);
  }

  async removePermission(input = {}) {
    return (await this.ensurePermissionManager()).removePermission(input);
  }

  async updatePermission(record = {}) {
    return (await this.ensurePermissionManager()).updatePermission(record);
  }

  checkPermission(input = {}) {
    if (!this.permissionManager) return {
      decision: 'ALLOW',
      allowed: true,
      status: 'UNKNOWN',
      permissionStatus: 'UNKNOWN',
      reason: 'permission-manager-not-initialized',
      permission: null
    };
    return this.permissionManager.checkPermission(input);
  }

  async refreshPermission(input = {}) {
    return (await this.ensurePermissionManager()).refreshPermission(input);
  }

  async synchronizePermissions() {
    return (await this.ensurePermissionManager()).synchronizePermissions();
  }

  async permissionExists(input = {}) {
    return (await this.ensurePermissionManager()).permissionExists(input);
  }

  async loadPermissions() {
    return (await this.ensurePermissionManager()).loadPermissions();
  }

  async cachePermission(record = {}) {
    return (await this.ensurePermissionManager()).cachePermission(record);
  }

  subscribeTrustUpdates(handler) {
    if (typeof handler !== 'function') return () => {};
    const events = [
      BLOCKCHAIN_EVENTS.TRUST_VERIFIED,
      BLOCKCHAIN_EVENTS.TRUST_REFRESHED,
      BLOCKCHAIN_EVENTS.TRUST_BLOCKED,
      BLOCKCHAIN_EVENTS.TRUST_REVOKED,
      BLOCKCHAIN_EVENTS.TRUST_PENDING,
      BLOCKCHAIN_EVENTS.TRUST_EXPIRED,
      BLOCKCHAIN_EVENTS.TRUST_CACHE_UPDATED,
      BLOCKCHAIN_EVENTS.TRUST_SYNCED,
      BLOCKCHAIN_EVENTS.TRUST_FAILED
    ];
    for (const event of events) this.on(event, handler);
    return () => {
      for (const event of events) this.off(event, handler);
    };
  }

  subscribePermissionUpdates(handler) {
    if (typeof handler !== 'function') return () => {};
    const events = [
      BLOCKCHAIN_EVENTS.PERMISSION_GRANTED,
      BLOCKCHAIN_EVENTS.PERMISSION_REMOVED,
      BLOCKCHAIN_EVENTS.PERMISSION_UPDATED,
      BLOCKCHAIN_EVENTS.PERMISSION_DENIED,
      BLOCKCHAIN_EVENTS.PERMISSION_REVOKED,
      BLOCKCHAIN_EVENTS.PERMISSION_EXPIRED,
      BLOCKCHAIN_EVENTS.PERMISSION_CACHE_UPDATED,
      BLOCKCHAIN_EVENTS.PERMISSION_SYNCED,
      BLOCKCHAIN_EVENTS.PERMISSION_REFRESHED,
      BLOCKCHAIN_EVENTS.PERMISSION_FAILED
    ];
    for (const event of events) this.on(event, handler);
    return () => {
      for (const event of events) this.off(event, handler);
    };
  }

  getDiagnostics() {
    return {
      state: this.state,
      initialized: this.initialized,
      config: this.config ? {
        enabled: this.config.enabled,
        network: this.config.network,
        networkName: this.config.networkName,
        chainId: this.config.chainId,
        rpcHost: safeHost(this.config.rpcUrl),
        explorerUrl: this.config.explorerUrl,
        requestTimeoutMs: this.config.requestTimeoutMs,
        connectionTimeoutMs: this.config.connectionTimeoutMs,
        retry: { ...this.config.retry },
        gas: { ...this.config.gas }
      } : null,
      client: this.client?.getStatus?.() || null,
      network: this.networkManager?.getStatus?.() || null,
      identity: this.identityManager?.getStatus?.() || null,
      pairing: this.pairManager?.getStatus?.() || null,
      trust: this.trustEngine ? {
        cacheSize: this.trustCache?.list?.().length || 0,
        registryConfigured: this.config?.trust?.registryAddress ? true : false
      } : null,
      permissions: this.permissionManager ? {
        cacheSize: this.permissionCache?.list?.().length || 0,
        registryConfigured: this.config?.permissions?.registryAddress ? true : false
      } : null,
      lastError: this.lastError?.toJSON?.() || null
    };
  }

  getStatus() {
    return {
      enabled: Boolean(this.config?.enabled),
      initialized: this.initialized,
      state: this.state,
      network: this.config ? {
        id: this.config.network,
        name: this.config.networkName,
        chainId: this.config.chainId,
        explorerUrl: this.config.explorerUrl
      } : null,
      health: this.health.snapshot(),
      wallet: this.walletManager?.getStatus?.() || { loaded: false, address: null, secureStorage: 'future' },
      identity: this.identityManager?.getStatus?.() || null,
      pairing: this.pairManager?.getStatus?.() || null,
      trust: this.trustEngine ? this.checkTrust({ operation: 'status' }) : null,
      permissions: this.permissionManager ? this.checkPermission({ operation: 'status' }) : null,
      diagnostics: this.getDiagnostics()
    };
  }

  async initializeLocalIdentity(options = {}) {
    if (this.config?.identity?.enabled === false) return null;
    const client = options.client || this.client || null;
    this.walletManager = this.walletManager || new this.WalletManagerClass({
      client,
      logger: this.logger.child({ component: 'wallet-manager' }),
      secureStore: this.walletSecureStore || new SecureWalletStore()
    });
    this.walletManager.client = client;
    this.identityStore = this.identityStore || new LocalIdentityStore({
      deviceType: this.config?.identity?.deviceType || 'desktop'
    });
    if (!this.identityManager) {
      this.identityManager = new this.IdentityManagerClass({
        config: this.config,
        client,
        walletManager: this.walletManager,
        identityStore: this.identityStore,
        logger: this.logger.child({ component: 'identity-manager' })
      });
    } else {
      this.identityManager.config = this.config;
      this.identityManager.walletManager = this.walletManager;
      if (this.identityManager.registryClient) this.identityManager.registryClient.client = client;
    }
    if (!this.identityEventsBound) {
      this.identityEventsBound = true;
      for (const event of [
        BLOCKCHAIN_EVENTS.IDENTITY_CREATED,
        BLOCKCHAIN_EVENTS.IDENTITY_REGISTERED,
        BLOCKCHAIN_EVENTS.IDENTITY_VERIFIED,
        BLOCKCHAIN_EVENTS.IDENTITY_FAILED,
        BLOCKCHAIN_EVENTS.IDENTITY_REVOKED,
        BLOCKCHAIN_EVENTS.IDENTITY_REFRESHED
      ]) {
        this.identityManager.on?.(event, payload => this.emit(event, payload));
      }
    }
    return this.identityManager.initialize({
      verify: options.verify !== undefined ? options.verify : Boolean(this.config?.enabled)
    });
  }

  async initializePairingTrust(options = {}) {
    if (this.config?.pairing?.enabled === false) return null;
    const client = options.client || this.client || null;
    await this.ensureIdentityManager();
    this.pairStore = this.pairStore || new LocalPairStore();
    if (!this.pairManager) {
      this.pairManager = new this.PairManagerClass({
        config: this.config,
        client,
        identityManager: this.identityManager,
        walletManager: this.walletManager,
        pairStore: this.pairStore,
        logger: this.logger.child({ component: 'pair-manager' })
      });
      for (const event of [
        BLOCKCHAIN_EVENTS.PAIR_CREATED,
        BLOCKCHAIN_EVENTS.PAIR_PENDING,
        BLOCKCHAIN_EVENTS.PAIR_APPROVED,
        BLOCKCHAIN_EVENTS.PAIR_REJECTED,
        BLOCKCHAIN_EVENTS.PAIR_REVOKED,
        BLOCKCHAIN_EVENTS.PAIR_EXPIRED,
        BLOCKCHAIN_EVENTS.PAIR_VERIFIED,
        BLOCKCHAIN_EVENTS.PAIR_SYNCED,
        BLOCKCHAIN_EVENTS.PAIR_FAILED
      ]) {
        this.pairManager.on?.(event, payload => this.emit(event, payload));
      }
    } else if (this.pairManager.registryClient) {
      this.pairManager.config = this.config;
      this.pairManager.registryClient.client = client;
    }
    return this.pairManager.synchronize();
  }

  async initializeTrustEngine(options = {}) {
    if (this.config?.trust?.enabled === false) return null;
    const client = options.client || this.client || null;
    this.trustCache = this.trustCache || new TrustCache({
      defaultTtlMs: this.config?.trust?.cacheTtlMs
    });
    this.trustManager = this.trustManager || new this.TrustManagerClass({
      config: this.config,
      client,
      walletManager: this.walletManager,
      cache: this.trustCache,
      logger: this.logger.child({ component: 'trust-manager' })
    });
    if (this.trustManager.registryClient) this.trustManager.registryClient.client = client;
    this.trustEngine = this.trustEngine || new this.DeviceTrustEngineClass({
      config: this.config,
      manager: this.trustManager,
      cache: this.trustCache,
      logger: this.logger.child({ component: 'trust-engine' })
    });
    if (!this.trustEventsBound) {
      for (const event of [
        BLOCKCHAIN_EVENTS.TRUST_CHECK_STARTED,
        BLOCKCHAIN_EVENTS.TRUST_VERIFIED,
        BLOCKCHAIN_EVENTS.TRUST_REFRESHED,
        BLOCKCHAIN_EVENTS.TRUST_BLOCKED,
        BLOCKCHAIN_EVENTS.TRUST_REVOKED,
        BLOCKCHAIN_EVENTS.TRUST_PENDING,
        BLOCKCHAIN_EVENTS.TRUST_EXPIRED,
        BLOCKCHAIN_EVENTS.TRUST_CACHE_UPDATED,
        BLOCKCHAIN_EVENTS.TRUST_SYNCED,
        BLOCKCHAIN_EVENTS.TRUST_FAILED
      ]) {
        this.trustEngine.on?.(event, payload => this.emit(event, payload));
        this.trustManager.on?.(event, payload => this.emit(event, payload));
      }
      this.trustEventsBound = true;
    }
    await this.trustCache.load();
    await this.trustEngine.synchronizeTrust().catch(error => {
      this.logger.warn('Trust synchronization failed; OpenX will continue', { error: error.message });
    });
    this.trustEngine.startBackgroundRefresh();
    return this.trustEngine;
  }

  async initializePermissionManager(options = {}) {
    if (this.config?.permissions?.enabled === false) return null;
    const client = options.client || this.client || null;
    this.permissionCache = this.permissionCache || new PermissionCache({
      defaultTtlMs: this.config?.permissions?.cacheTtlMs
    });
    this.permissionManager = this.permissionManager || new this.PermissionManagerClass({
      config: this.config,
      client,
      walletManager: this.walletManager,
      cache: this.permissionCache,
      localPolicyProvider: options.localPolicyProvider,
      osPermissionProvider: options.osPermissionProvider,
      logger: this.logger.child({ component: 'permission-manager' })
    });
    this.permissionManager.config = this.config;
    this.permissionManager.permissionConfig = this.config?.permissions || {};
    if (this.permissionManager.registryClient) this.permissionManager.registryClient.client = client;
    if (!this.permissionEventsBound) {
      for (const event of [
        BLOCKCHAIN_EVENTS.PERMISSION_GRANTED,
        BLOCKCHAIN_EVENTS.PERMISSION_REMOVED,
        BLOCKCHAIN_EVENTS.PERMISSION_UPDATED,
        BLOCKCHAIN_EVENTS.PERMISSION_DENIED,
        BLOCKCHAIN_EVENTS.PERMISSION_REVOKED,
        BLOCKCHAIN_EVENTS.PERMISSION_EXPIRED,
        BLOCKCHAIN_EVENTS.PERMISSION_CACHE_UPDATED,
        BLOCKCHAIN_EVENTS.PERMISSION_SYNCED,
        BLOCKCHAIN_EVENTS.PERMISSION_REFRESHED,
        BLOCKCHAIN_EVENTS.PERMISSION_FAILED
      ]) {
        this.permissionManager.on?.(event, payload => this.emit(event, payload));
      }
      this.permissionEventsBound = true;
    }
    await this.permissionCache.load();
    await this.permissionManager.synchronizePermissions().catch(error => {
      this.logger.warn('Permission synchronization failed; OpenX will continue', { error: error.message });
    });
    this.permissionManager.startBackgroundSync();
    return this.permissionManager;
  }

  async synchronizeIdentitySafely() {
    if (!this.identityManager || this.config?.identity?.enabled === false) return null;
    try {
      if (this.config?.identity?.autoRegister !== false) {
        await this.identityManager.synchronizeIdentity();
      }
      if (this.config?.identity?.verifyOnStartup !== false) {
        await this.identityManager.verifyIdentity();
      }
      await this.initializePairingTrust({ client: this.client });
      await this.initializeTrustEngine({ client: this.client });
      await this.initializePermissionManager({ client: this.client });
    } catch (error) {
      this.logger.warn('Blockchain identity synchronization failed; OpenX will continue', {
        error: error.message
      });
    }
    return this.identityManager.getStatus();
  }

  async ensureIdentityManager() {
    if (!this.identityManager) await this.initializeLocalIdentity({ client: this.client });
    return this.identityManager;
  }

  async ensurePairManager() {
    if (!this.pairManager) await this.initializePairingTrust({ client: this.client });
    return this.pairManager;
  }

  async ensureTrustEngine() {
    if (!this.trustEngine) await this.initializeTrustEngine({ client: this.client });
    return this.trustEngine;
  }

  async ensurePermissionManager() {
    if (!this.permissionManager) await this.initializePermissionManager({ client: this.client });
    return this.permissionManager;
  }

  bindClientEvents(client) {
    client.on?.(BLOCKCHAIN_EVENTS.CONNECTED, payload => {
      this.state = BLOCKCHAIN_STATES.CONNECTED;
      this.health.recordConnection(true);
      this.emit(BLOCKCHAIN_EVENTS.CONNECTED, payload);
    });
    client.on?.(BLOCKCHAIN_EVENTS.DISCONNECTED, payload => {
      this.health.recordConnection(false);
      this.emit(BLOCKCHAIN_EVENTS.DISCONNECTED, payload);
    });
    client.on?.(BLOCKCHAIN_EVENTS.RECONNECTED, payload => this.emit(BLOCKCHAIN_EVENTS.RECONNECTED, payload));
    client.on?.(BLOCKCHAIN_EVENTS.NETWORK_CHANGED, payload => this.emit(BLOCKCHAIN_EVENTS.NETWORK_CHANGED, payload));
    client.on?.(BLOCKCHAIN_EVENTS.ERROR, payload => this.emit(BLOCKCHAIN_EVENTS.ERROR, payload));
    client.on?.('retry', () => this.health.recordRetry());
  }

  bindNetworkEvents(manager) {
    manager.on?.(BLOCKCHAIN_EVENTS.HEALTH_CHANGED, payload => this.emit(BLOCKCHAIN_EVENTS.HEALTH_CHANGED, payload));
    manager.on?.(BLOCKCHAIN_EVENTS.ERROR, payload => this.emit(BLOCKCHAIN_EVENTS.ERROR, payload));
  }
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch (_) {
    return '';
  }
}

module.exports = BlockchainService;
