'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const {
  AvalancheClient,
  BlockchainHealth,
  BlockchainService,
  BlockchainPairManager,
  ConfigManager,
  DeviceTrustEngine,
  IdentityManager,
  IdentityConstants,
  LocalIdentityStore,
  LocalPairStore,
  PermissionCache,
  PermissionManager,
  SecureWalletStore,
  TrustCache,
  TrustManager,
  NetworkManager,
  WalletManager,
  WalletError
} = require('../../core/blockchain');

describe('Blockchain Foundation', function() {
  class FakeProvider {
    constructor(options = {}) {
      this.options = options;
      this.blockNumber = options.blockNumber || 100;
      this.network = options.network || { name: 'fuji', chainId: 43113 };
      this.failures = Number(options.failures || 0);
      this.destroyed = false;
    }

    async getNetwork() {
      if (this.failures > 0) {
        this.failures -= 1;
        throw new Error('temporary rpc failure');
      }
      return this.network;
    }

    async getBlockNumber() {
      return this.blockNumber;
    }

    async getFeeData() {
      return { gasPrice: 1n };
    }

    async send(method, params) {
      return { method, params };
    }

    async destroy() {
      this.destroyed = true;
    }
  }

  it('builds Fuji configuration from environment values', function() {
    const manager = new ConfigManager({
      env: {
        OPENX_BLOCKCHAIN_ENABLED: 'true',
        OPENX_BLOCKCHAIN_NETWORK: 'fuji',
        OPENX_BLOCKCHAIN_RPC_URL: 'https://example.test/rpc',
        OPENX_BLOCKCHAIN_RETRY_ATTEMPTS: '2'
      }
    });

    const config = manager.getConfig();

    assert.equal(config.enabled, true);
    assert.equal(config.network, 'fuji');
    assert.equal(config.chainId, 43113);
    assert.equal(config.rpcUrl, 'https://example.test/rpc');
    assert.equal(config.retry.attempts, 2);
  });

  it('rejects unsupported network configuration', function() {
    const manager = new ConfigManager({ env: { OPENX_BLOCKCHAIN_NETWORK: 'unknown' } });

    assert.throws(() => manager.getConfig(), error => error.code === 'BLOCKCHAIN_NETWORK_UNSUPPORTED');
  });

  it('connects through AvalancheClient without exposing the raw provider', async function() {
    const client = new AvalancheClient({
      config: testConfig(),
      providerFactory: () => new FakeProvider()
    });

    const status = await client.connect();
    const access = client.getProviderAccess();
    const blockNumber = await access.getBlockNumber();

    assert.equal(status.connected, true);
    assert.equal(status.network.chainId, 43113);
    assert.equal(blockNumber, 100);
    assert.equal(typeof access.getBlockNumber, 'function');
    assert.equal(Object.prototype.hasOwnProperty.call(access, 'provider'), false);
    await client.disconnect('test-complete');
  });

  it('retries transient provider failures', async function() {
    const provider = new FakeProvider({ failures: 1 });
    const client = new AvalancheClient({
      config: testConfig({ retry: { attempts: 2, baseDelayMs: 0, maxDelayMs: 0 } }),
      providerFactory: () => provider
    });

    const status = await client.connect();

    assert.equal(status.connected, true);
    assert.equal(client.getStatus().retryCount, 1);
    await client.disconnect('test-complete');
  });

  it('tracks health state, latency, block, retry count, and uptime', function() {
    let now = 1000;
    const health = new BlockchainHealth({ now: () => now });
    health.start();
    health.recordRetry();
    now = 1500;
    const snapshot = health.recordHealth({
      connected: true,
      healthy: true,
      latencyMs: 25,
      blockNumber: 123,
      lastSyncAt: '2026-07-15T00:00:00.000Z'
    });

    assert.equal(snapshot.connected, true);
    assert.equal(snapshot.healthy, true);
    assert.equal(snapshot.latencyMs, 25);
    assert.equal(snapshot.lastBlock, 123);
    assert.equal(snapshot.retryCount, 1);
    assert.equal(snapshot.uptimeMs, 500);
  });

  it('detects network and reports health', async function() {
    const client = new AvalancheClient({
      config: testConfig(),
      providerFactory: () => new FakeProvider({ blockNumber: 321 })
    });
    await client.connect();
    const health = new BlockchainHealth();
    const manager = new NetworkManager({
      client,
      config: testConfig(),
      health,
      logger: silentLogger()
    });

    const status = await manager.healthCheck();

    assert.equal(status.connected, true);
    assert.equal(status.healthy, true);
    assert.equal(status.lastBlock, 321);
    await manager.shutdown();
    await client.disconnect('test-complete');
  });

  it('returns an unhealthy startup status instead of throwing when blockchain is unavailable', async function() {
    class FailingClient {
      on() {}
      async connect() {
        throw new Error('rpc unavailable');
      }
    }

    const service = new BlockchainService({
      configManager: new ConfigManager({ env: { OPENX_BLOCKCHAIN_ENABLED: 'true' } }),
      ClientClass: FailingClient,
      logger: silentLogger()
    });

    const status = await service.initialize();

    assert.equal(status.enabled, true);
    assert.equal(status.initialized, false);
    assert.equal(status.state, 'error');
    assert.match(status.health.lastError, /rpc unavailable/);
  });

  it('initializes, exposes controlled accessors, and shuts down cleanly', async function() {
    class FakeClient extends EventEmitter {
      constructor() {
        super();
        this.disconnected = false;
      }

      async connect() {
        this.emit('blockchain.connected', { network: { chainId: 43113 } });
        return { connected: true };
      }

      getProviderAccess() {
        return { getBlockNumber: async () => 99 };
      }

      getStatus() {
        return { connected: !this.disconnected };
      }

      async disconnect() {
        this.disconnected = true;
      }
    }

    class FakeNetworkManager extends EventEmitter {
      async validateRPC() {
        return { connected: true };
      }

      startHealthMonitoring() {
        this.monitoring = true;
      }

      stopHealthMonitoring() {
        this.monitoring = false;
      }

      getStatus() {
        return { connected: true };
      }

      async shutdown() {
        this.shutdownCalled = true;
      }
    }

    const service = new BlockchainService({
      configManager: new ConfigManager({ env: { OPENX_BLOCKCHAIN_ENABLED: 'true' } }),
      ClientClass: FakeClient,
      NetworkManagerClass: FakeNetworkManager,
      logger: silentLogger()
    });

    const initialized = await service.initialize();
    assert.equal(initialized.initialized, true);
    assert.equal(await service.getProviderAccess().getBlockNumber(), 99);
    assert.deepEqual(service.getContractAccess(), {});

    const stopped = await service.shutdown('test');
    assert.equal(stopped.state, 'stopped');
    assert.equal(stopped.initialized, false);
  });

  it('keeps future wallet creation unimplemented behind a custom WalletError', function() {
    const manager = new WalletManager();

    assert.throws(() => manager.importWallet(), error => error instanceof WalletError &&
      error.code === 'BLOCKCHAIN_WALLET_IMPORT_NOT_IMPLEMENTED');
  });

  it('generates human-readable non-PII device IDs', function() {
    const deviceId = IdentityManager.generateDeviceId('desktop');

    assert.match(deviceId, /^OPENX-DESKTOP-[0-9A-HJKMNP-TV-Z]{16}$/);
  });

  it('generates and reloads a wallet through secure storage', async function() {
    const secureStore = new SecureWalletStore();
    const manager = new WalletManager({ secureStore });

    const generated = await manager.ensureWallet();
    await manager.shutdown();
    const reloaded = await manager.ensureWallet();

    assert.equal(generated.loaded, true);
    assert.equal(generated.address, reloaded.address);
    assert.match(generated.address, /^0x[a-fA-F0-9]{40}$/);
  });

  it('creates a local pending identity without a configured registry', async function() {
    const secureStore = new SecureWalletStore();
    const walletManager = new WalletManager({ secureStore });
    const identityStore = new LocalIdentityStore({ deviceType: 'desktop' });
    const manager = new IdentityManager({
      config: testConfig({ identity: testIdentityConfig() }),
      walletManager,
      identityStore,
      logger: silentLogger()
    });

    const identity = await manager.initialize({ verify: false });
    const registered = await manager.registerIdentity();

    assert.match(identity.deviceId, /^OPENX-DESKTOP-/);
    assert.equal(registered.status, IdentityConstants.IDENTITY_STATUS.PENDING);
    assert.equal(registered.walletAddress, identity.walletAddress);
    assert.equal(registered.transactionHash, '');
  });

  it('registers and verifies identity through the registry adapter without exposing contracts', async function() {
    const secureStore = new SecureWalletStore();
    const walletManager = new WalletManager({ secureStore });
    const identityStore = new LocalIdentityStore({ deviceType: 'desktop' });
    const registryClient = {
      isConfigured: () => true,
      async register(identity) {
        return {
          transactionHash: '0xabc',
          blockNumber: 12,
          registeredAt: '2026-07-15T00:00:00.000Z',
          deviceId: identity.deviceId
        };
      },
      async verify() {
        return true;
      },
      async exists() {
        return true;
      },
      async get(identityDeviceId) {
        return {
          deviceId: identityDeviceId,
          status: 'REGISTERED',
          registeredAt: '2026-07-15T00:00:00.000Z'
        };
      }
    };
    const manager = new IdentityManager({
      config: testConfig({ identity: testIdentityConfig({ registryAddress: '0x0000000000000000000000000000000000000001' }) }),
      walletManager,
      identityStore,
      registryClient,
      logger: silentLogger()
    });

    await manager.initialize({ verify: false });
    const registered = await manager.registerIdentity();
    const verified = await manager.verifyIdentity();

    assert.equal(registered.status, 'REGISTERED');
    assert.equal(registered.transactionHash, '0xabc');
    assert.equal(verified.valid, true);
    assert.equal(await manager.identityExists(), true);
  });

  it('exposes Phase 2 identity methods through BlockchainService', async function() {
    class FakeClient extends EventEmitter {
      async connect() {
        this.emit('blockchain.connected', { network: { chainId: 43113 } });
        return { connected: true };
      }

      getStatus() {
        return { connected: true };
      }

      async disconnect() {}
    }

    class FakeNetworkManager extends EventEmitter {
      async validateRPC() {
        return { connected: true };
      }

      startHealthMonitoring() {}
      stopHealthMonitoring() {}
      getStatus() { return { connected: true }; }
      async shutdown() {}
    }

    const service = new BlockchainService({
      configManager: new ConfigManager({ env: { OPENX_BLOCKCHAIN_ENABLED: 'true' } }),
      ClientClass: FakeClient,
      NetworkManagerClass: FakeNetworkManager,
      identityStore: new LocalIdentityStore({ deviceType: 'desktop' }),
      walletSecureStore: new SecureWalletStore(),
      logger: silentLogger()
    });

    await service.initialize();
    const identity = await service.getIdentity();
    const exists = await service.identityExists();
    const refreshed = await service.refreshIdentity();

    assert.match(identity.deviceId, /^OPENX-DESKTOP-/);
    assert.equal(exists, false);
    assert.equal(refreshed.deviceId, identity.deviceId);
    assert.equal(service.getStatus().identity.identity.deviceId, identity.deviceId);
    await service.shutdown('identity-test');
  });

  it('creates deterministic pair hashes from token and device metadata', function() {
    const input = {
      pairToken: '0x' + 'a'.repeat(64),
      desktopDeviceId: 'OPENX-DESKTOP-1234567890ABCDEF',
      desktopWallet: '0x0000000000000000000000000000000000000001',
      createdAt: 1000,
      nonce: '0x1234'
    };

    const first = BlockchainPairManager.createPairHash(input);
    const second = BlockchainPairManager.createPairHash({ ...input, desktopWallet: input.desktopWallet.toUpperCase() });

    assert.equal(first, second);
    assert.match(first, /^0x[a-f0-9]{64}$/);
  });

  it('creates QR-safe pair trust metadata without storing the raw token', async function() {
    const manager = createPairManager();

    const result = await manager.createPair({ pairToken: '0x' + 'b'.repeat(64), ttlMs: 60000 });
    const stored = await manager.getPair(result.pair.pairHash);

    assert.equal(result.qr.t, '0x' + 'b'.repeat(64));
    assert.equal(stored.pairHash, result.pair.pairHash);
    assert.equal(Object.prototype.hasOwnProperty.call(stored, 'pairToken'), false);
    assert.equal(result.pair.status, 'WAITING_APPROVAL');
  });

  it('verifies pair QR hash and approves a local pair', async function() {
    const manager = createPairManager();
    const created = await manager.createPair({ pairToken: '0x' + 'c'.repeat(64), ttlMs: 60000 });

    const verified = await manager.verifyPair(created.qr);
    const approved = await manager.approvePair(created.qr);

    assert.equal(verified.valid, true);
    assert.equal(approved.status, 'APPROVED');
    assert.equal(approved.phoneDeviceId, 'OPENX-PHONE-TESTDEVICE');
    assert.equal(approved.phoneWallet, '0x0000000000000000000000000000000000000002');
  });

  it('rejects mismatched pair hashes', async function() {
    const manager = createPairManager();
    const created = await manager.createPair({ pairToken: '0x' + 'd'.repeat(64), ttlMs: 60000 });

    await assert.rejects(
      () => manager.verifyPair({ ...created.qr, t: '0x' + 'e'.repeat(64) }),
      error => error.code === 'BLOCKCHAIN_PAIR_HASH_MISMATCH'
    );
  });

  it('expires pending pair records during synchronization', async function() {
    const manager = createPairManager({ now: () => 10_000 });
    const created = await manager.createPair({ pairToken: '0x' + 'f'.repeat(64), ttlMs: 1000 });
    manager.now = () => 12_000;

    await manager.synchronize();
    const expired = await manager.getPair(created.pair.pairHash);

    assert.equal(expired.status, 'EXPIRED');
  });

  it('allows trusted cached devices within the latency budget', async function() {
    const cache = new TrustCache();
    await cache.set({
      deviceId: 'PHONE-1',
      walletAddress: '0x0000000000000000000000000000000000000002',
      trustStatus: 'TRUSTED',
      expiresAt: new Date(Date.now() + 60000).toISOString()
    });
    const engine = new DeviceTrustEngine({
      config: testConfig(),
      cache,
      manager: new TrustManager({ config: testConfig(), cache, logger: silentLogger() }),
      logger: silentLogger()
    });

    const started = Date.now();
    const result = engine.checkTrust({ deviceId: 'PHONE-1', operation: 'assistant-command' });

    assert.equal(result.allowed, true);
    assert.equal(result.decision, 'ALLOW');
    assert.ok(Date.now() - started < 10);
  });

  it('blocks blocked devices from cache', async function() {
    const cache = new TrustCache();
    await cache.set({
      deviceId: 'PHONE-2',
      trustStatus: 'BLOCKED',
      expiresAt: new Date(Date.now() + 60000).toISOString()
    });
    const engine = new DeviceTrustEngine({
      config: testConfig(),
      cache,
      manager: new TrustManager({ config: testConfig(), cache, logger: silentLogger() }),
      logger: silentLogger()
    });

    const result = engine.checkTrust({ deviceId: 'PHONE-2', operation: 'file-transfer' });

    assert.equal(result.allowed, false);
    assert.equal(result.decision, 'BLOCKED');
  });

  it('uses backward-compatible unknown-device policy when no trust registry is configured', function() {
    const cache = new TrustCache();
    const engine = new DeviceTrustEngine({
      config: testConfig({ trust: { enabled: true, registryAddress: '', allowUnknownWhenNoRegistry: true, strict: false } }),
      cache,
      manager: new TrustManager({ config: testConfig(), cache, logger: silentLogger() }),
      logger: silentLogger()
    });

    const result = engine.checkTrust({ deviceId: 'UNKNOWN-PHONE', operation: 'notification-sync' });

    assert.equal(result.allowed, true);
    assert.equal(result.reason, 'unknown-allowed-no-registry');
  });

  it('exposes trust cache and checks through BlockchainService', async function() {
    const service = new BlockchainService({
      configManager: new ConfigManager({ env: {} }),
      trustCache: new TrustCache(),
      logger: silentLogger()
    });

    await service.initialize();
    await service.cacheTrust({
      deviceId: 'PHONE-3',
      trustStatus: 'TRUSTED',
      expiresAt: new Date(Date.now() + 60000).toISOString()
    });
    const result = service.checkTrust({ deviceId: 'PHONE-3', operation: 'remote-command' });

    assert.equal(result.allowed, true);
    await service.shutdown('trust-test');
  });

  it('allows granted cached permissions within the latency budget', async function() {
    const cache = new PermissionCache();
    await cache.set({
      deviceId: 'PHONE-PERM-1',
      permissionName: 'remoteCommands',
      status: 'GRANTED',
      expiresAt: new Date(Date.now() + 60000).toISOString()
    });
    const manager = new PermissionManager({ config: testConfig(), cache, logger: silentLogger() });
    const started = Date.now();
    const result = manager.checkPermission({ deviceId: 'PHONE-PERM-1', permissionName: 'remoteCommands' });

    assert.equal(result.allowed, true);
    assert.equal(result.decision, 'ALLOW');
    assert.ok(Date.now() - started < 10);
  });

  it('denies revoked cached permissions', async function() {
    const cache = new PermissionCache();
    await cache.set({
      deviceId: 'PHONE-PERM-2',
      permissionName: 'fileTransfer',
      status: 'REVOKED',
      expiresAt: new Date(Date.now() + 60000).toISOString()
    });
    const manager = new PermissionManager({ config: testConfig(), cache, logger: silentLogger() });
    const result = manager.checkPermission({ deviceId: 'PHONE-PERM-2', permissionName: 'fileTransfer' });

    assert.equal(result.allowed, false);
    assert.equal(result.decision, 'BLOCK');
  });

  it('combines local policy with blockchain permission decisions', async function() {
    const cache = new PermissionCache();
    await cache.set({
      deviceId: 'PHONE-PERM-3',
      permissionName: 'notifications',
      status: 'GRANTED',
      expiresAt: new Date(Date.now() + 60000).toISOString()
    });
    const manager = new PermissionManager({
      config: testConfig(),
      cache,
      localPolicyProvider: () => ({ allowed: false, source: 'local-policy' }),
      logger: silentLogger()
    });
    const result = manager.checkPermission({ deviceId: 'PHONE-PERM-3', permissionName: 'notifications' });

    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'local-policy-denied');
  });

  it('uses backward-compatible unknown-permission policy when no permission registry is configured', function() {
    const manager = new PermissionManager({
      config: testConfig({ permissions: { enabled: true, registryAddress: '', allowUnknownWhenNoRegistry: true, strict: false } }),
      cache: new PermissionCache(),
      logger: silentLogger()
    });
    const result = manager.checkPermission({ deviceId: 'UNKNOWN-PHONE', permissionName: 'clipboard' });

    assert.equal(result.allowed, true);
    assert.equal(result.reason, 'unknown-allowed-no-registry');
  });

  it('exposes permission cache and checks through BlockchainService', async function() {
    const service = new BlockchainService({
      configManager: new ConfigManager({ env: {} }),
      permissionCache: new PermissionCache(),
      logger: silentLogger()
    });

    await service.initialize();
    await service.cachePermission({
      deviceId: 'PHONE-PERM-4',
      permissionName: 'remoteCommands',
      status: 'GRANTED',
      expiresAt: new Date(Date.now() + 60000).toISOString()
    });
    const result = service.checkPermission({ deviceId: 'PHONE-PERM-4', permissionName: 'remoteCommands' });

    assert.equal(result.allowed, true);
    await service.shutdown('permission-test');
  });
});

function testConfig(overrides = {}) {
  return {
    enabled: true,
    network: 'fuji',
    networkName: 'Avalanche Fuji C-Chain',
    rpcUrl: 'https://example.test/rpc',
    chainId: 43113,
    explorerUrl: 'https://subnets-test.avax.network/c-chain',
    requestTimeoutMs: 100,
    connectionTimeoutMs: 100,
    healthIntervalMs: 60000,
    retry: { attempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
    gas: { maxFeePerGasGwei: 50, maxPriorityFeePerGasGwei: 2, gasLimitMultiplier: 1.2 },
    identity: testIdentityConfig(),
    trust: {
      enabled: true,
      registryAddress: '',
      cacheTtlMs: 60000,
      backgroundRefreshMs: 0,
      offlinePolicy: 'allow-valid-cache',
      allowUnknownWhenNoRegistry: true,
      strict: false
    },
    permissions: {
      enabled: true,
      registryAddress: '',
      cacheTtlMs: 60000,
      backgroundRefreshMs: 0,
      offlinePolicy: 'allow-valid-cache',
      allowUnknownWhenNoRegistry: true,
      strict: false
    },
    ...overrides
  };
}

function testIdentityConfig(overrides = {}) {
  return {
    enabled: true,
    deviceType: 'desktop',
    registryAddress: '',
    verifyOnStartup: false,
    autoRegister: false,
    registrationRetryAttempts: 1,
    registrationRetryBaseDelayMs: 0,
    registrationRetryMaxDelayMs: 0,
    ...overrides
  };
}

function silentLogger() {
  return {
    error() {},
    warn() {},
    info() {},
    debug() {},
    child() { return this; }
  };
}

function createPairManager(options = {}) {
  const walletManager = {
    getSigner() { return {}; }
  };
  const identityManager = {
    async getIdentity() {
      if (options.phone) {
        return {
          deviceId: 'OPENX-PHONE-TESTDEVICE',
          walletAddress: '0x0000000000000000000000000000000000000002'
        };
      }
      return {
        deviceId: 'OPENX-DESKTOP-TESTDEVICE',
        walletAddress: '0x0000000000000000000000000000000000000001'
      };
    }
  };
  const pairStore = new LocalPairStore();
  const manager = new BlockchainPairManager({
    config: testConfig({
      pairing: {
        enabled: true,
        registryAddress: '',
        pairLifetimeMs: 60000
      }
    }),
    identityManager,
    walletManager,
    pairStore,
    logger: silentLogger(),
    now: options.now || (() => 1000)
  });
  const originalApprove = manager.approvePair.bind(manager);
  manager.approvePair = async payload => {
    manager.identityManager = {
      async getIdentity() {
        return {
          deviceId: 'OPENX-PHONE-TESTDEVICE',
          walletAddress: '0x0000000000000000000000000000000000000002'
        };
      }
    };
    return originalApprove(payload);
  };
  return manager;
}
