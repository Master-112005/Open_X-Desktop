'use strict';

const BLOCKCHAIN_NETWORKS = Object.freeze({
  fuji: Object.freeze({
    id: 'fuji',
    networkName: 'Avalanche Fuji C-Chain',
    rpcEnv: 'OPENX_BLOCKCHAIN_FUJI_RPC_URL',
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    chainId: 43113,
    explorerUrl: 'https://subnets-test.avax.network/c-chain',
    currencySymbol: 'AVAX'
  }),
  mainnet: Object.freeze({
    id: 'mainnet',
    networkName: 'Avalanche C-Chain',
    rpcEnv: 'OPENX_BLOCKCHAIN_MAINNET_RPC_URL',
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    chainId: 43114,
    explorerUrl: 'https://subnets.avax.network/c-chain',
    currencySymbol: 'AVAX'
  }),
  local: Object.freeze({
    id: 'local',
    networkName: 'Avalanche Local C-Chain',
    rpcEnv: 'OPENX_BLOCKCHAIN_LOCAL_RPC_URL',
    rpcUrl: 'http://127.0.0.1:9650/ext/bc/C/rpc',
    chainId: 43112,
    explorerUrl: '',
    currencySymbol: 'AVAX'
  })
});

const DEFAULT_BLOCKCHAIN_CONFIG = Object.freeze({
  enabled: false,
  network: 'fuji',
  requestTimeoutMs: 8000,
  connectionTimeoutMs: 8000,
  healthIntervalMs: 30000,
  retry: Object.freeze({
    attempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 5000
  }),
  gas: Object.freeze({
    maxFeePerGasGwei: 50,
    maxPriorityFeePerGasGwei: 2,
    gasLimitMultiplier: 1.2
  }),
  identity: Object.freeze({
    enabled: true,
    deviceType: 'desktop',
    registryAddress: '',
    verifyOnStartup: true,
    autoRegister: true,
    registrationRetryAttempts: 3,
    registrationRetryBaseDelayMs: 1000,
    registrationRetryMaxDelayMs: 10000
  }),
  pairing: Object.freeze({
    enabled: true,
    registryAddress: '',
    pairLifetimeMs: 5 * 60 * 1000,
    retryDelayMs: 1000,
    verificationTimeoutMs: 15000,
    approvalTimeoutMs: 60000,
    synchronizationTimeoutMs: 15000
  }),
  trust: Object.freeze({
    enabled: true,
    registryAddress: '',
    cacheTtlMs: 24 * 60 * 60 * 1000,
    backgroundRefreshMs: 15 * 60 * 1000,
    offlinePolicy: 'allow-valid-cache',
    allowUnknownWhenNoRegistry: true,
    strict: false
  }),
  permissions: Object.freeze({
    enabled: true,
    registryAddress: '',
    cacheTtlMs: 24 * 60 * 60 * 1000,
    backgroundRefreshMs: 15 * 60 * 1000,
    offlinePolicy: 'allow-valid-cache',
    allowUnknownWhenNoRegistry: true,
    strict: false
  })
});

const BLOCKCHAIN_STATES = Object.freeze({
  STOPPED: 'stopped',
  INITIALIZING: 'initializing',
  INITIALIZED: 'initialized',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  UNHEALTHY: 'unhealthy',
  ERROR: 'error'
});

module.exports = {
  BLOCKCHAIN_NETWORKS,
  DEFAULT_BLOCKCHAIN_CONFIG,
  BLOCKCHAIN_STATES
};
