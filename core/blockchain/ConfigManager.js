'use strict';

const { BLOCKCHAIN_NETWORKS, DEFAULT_BLOCKCHAIN_CONFIG } = require('./BlockchainConstants');
const { ConfigurationError } = require('./BlockchainErrors');

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function normalizeUrl(value, fieldName) {
  const raw = String(value || '').trim();
  if (!raw) throw new ConfigurationError(fieldName + ' is required.', { code: 'BLOCKCHAIN_CONFIG_REQUIRED' });
  let parsed;
  try {
    parsed = new URL(raw);
  } catch (error) {
    throw new ConfigurationError(fieldName + ' is invalid.', {
      code: 'BLOCKCHAIN_CONFIG_INVALID_URL',
      cause: error,
      details: { fieldName }
    });
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new ConfigurationError(fieldName + ' must use http or https.', {
      code: 'BLOCKCHAIN_CONFIG_INVALID_PROTOCOL',
      details: { fieldName, protocol: parsed.protocol }
    });
  }
  parsed.hash = '';
  return parsed.toString();
}

class ConfigManager {
  constructor(options = {}) {
    this.env = options.env || process.env;
    this.baseConfig = options.config || {};
  }

  getConfig(overrides = {}) {
    const configured = this.baseConfig.blockchain || this.baseConfig || {};
    const env = this.env;
    const networkId = String(
      overrides.network ||
      env.OPENX_BLOCKCHAIN_NETWORK ||
      configured.network ||
      DEFAULT_BLOCKCHAIN_CONFIG.network
    ).trim().toLowerCase();
    const networkTemplate = BLOCKCHAIN_NETWORKS[networkId];
    if (!networkTemplate) {
      throw new ConfigurationError('Unsupported blockchain network.', {
        code: 'BLOCKCHAIN_NETWORK_UNSUPPORTED',
        details: { network: networkId, supported: Object.keys(BLOCKCHAIN_NETWORKS) }
      });
    }

    const networkConfig = configured.networks?.[networkId] || {};
    const rpcUrl = overrides.rpcUrl ||
      env.OPENX_BLOCKCHAIN_RPC_URL ||
      env[networkTemplate.rpcEnv] ||
      networkConfig.rpcUrl ||
      configured.rpcUrl ||
      networkTemplate.rpcUrl;
    const chainId = parseNumber(
      overrides.chainId || env.OPENX_BLOCKCHAIN_CHAIN_ID || networkConfig.chainId || configured.chainId || networkTemplate.chainId,
      networkTemplate.chainId,
      1,
      Number.MAX_SAFE_INTEGER
    );

    const config = {
      enabled: parseBoolean(
        overrides.enabled ?? env.OPENX_BLOCKCHAIN_ENABLED ?? configured.enabled,
        DEFAULT_BLOCKCHAIN_CONFIG.enabled
      ),
      network: networkId,
      networkName: overrides.networkName || networkConfig.networkName || networkTemplate.networkName,
      rpcUrl: normalizeUrl(rpcUrl, 'Blockchain RPC URL'),
      chainId,
      explorerUrl: String(overrides.explorerUrl || networkConfig.explorerUrl || networkTemplate.explorerUrl || ''),
      currencySymbol: String(overrides.currencySymbol || networkConfig.currencySymbol || networkTemplate.currencySymbol || 'AVAX'),
      requestTimeoutMs: parseNumber(
        overrides.requestTimeoutMs || env.OPENX_BLOCKCHAIN_REQUEST_TIMEOUT_MS || configured.requestTimeoutMs,
        DEFAULT_BLOCKCHAIN_CONFIG.requestTimeoutMs,
        1000,
        120000
      ),
      connectionTimeoutMs: parseNumber(
        overrides.connectionTimeoutMs || env.OPENX_BLOCKCHAIN_CONNECTION_TIMEOUT_MS || configured.connectionTimeoutMs,
        DEFAULT_BLOCKCHAIN_CONFIG.connectionTimeoutMs,
        1000,
        120000
      ),
      healthIntervalMs: parseNumber(
        overrides.healthIntervalMs || env.OPENX_BLOCKCHAIN_HEALTH_INTERVAL_MS || configured.healthIntervalMs,
        DEFAULT_BLOCKCHAIN_CONFIG.healthIntervalMs,
        5000,
        300000
      ),
      retry: {
        attempts: parseNumber(
          overrides.retry?.attempts || env.OPENX_BLOCKCHAIN_RETRY_ATTEMPTS || configured.retry?.attempts,
          DEFAULT_BLOCKCHAIN_CONFIG.retry.attempts,
          1,
          10
        ),
        baseDelayMs: parseNumber(
          overrides.retry?.baseDelayMs || env.OPENX_BLOCKCHAIN_RETRY_BASE_DELAY_MS || configured.retry?.baseDelayMs,
          DEFAULT_BLOCKCHAIN_CONFIG.retry.baseDelayMs,
          0,
          60000
        ),
        maxDelayMs: parseNumber(
          overrides.retry?.maxDelayMs || env.OPENX_BLOCKCHAIN_RETRY_MAX_DELAY_MS || configured.retry?.maxDelayMs,
          DEFAULT_BLOCKCHAIN_CONFIG.retry.maxDelayMs,
          0,
          120000
        )
      },
      gas: {
        maxFeePerGasGwei: parseNumber(
          overrides.gas?.maxFeePerGasGwei || env.OPENX_BLOCKCHAIN_MAX_FEE_GWEI || configured.gas?.maxFeePerGasGwei,
          DEFAULT_BLOCKCHAIN_CONFIG.gas.maxFeePerGasGwei,
          0,
          10000
        ),
        maxPriorityFeePerGasGwei: parseNumber(
          overrides.gas?.maxPriorityFeePerGasGwei || env.OPENX_BLOCKCHAIN_PRIORITY_FEE_GWEI || configured.gas?.maxPriorityFeePerGasGwei,
          DEFAULT_BLOCKCHAIN_CONFIG.gas.maxPriorityFeePerGasGwei,
          0,
          10000
        ),
        gasLimitMultiplier: parseNumber(
          overrides.gas?.gasLimitMultiplier || env.OPENX_BLOCKCHAIN_GAS_LIMIT_MULTIPLIER || configured.gas?.gasLimitMultiplier,
          DEFAULT_BLOCKCHAIN_CONFIG.gas.gasLimitMultiplier,
          1,
          5
        )
      },
      identity: {
        enabled: parseBoolean(
          overrides.identity?.enabled ?? env.OPENX_BLOCKCHAIN_IDENTITY_ENABLED ?? configured.identity?.enabled,
          DEFAULT_BLOCKCHAIN_CONFIG.identity.enabled
        ),
        deviceType: String(
          overrides.identity?.deviceType ||
          env.OPENX_BLOCKCHAIN_DEVICE_TYPE ||
          configured.identity?.deviceType ||
          DEFAULT_BLOCKCHAIN_CONFIG.identity.deviceType
        ).trim().toLowerCase(),
        registryAddress: String(
          overrides.identity?.registryAddress ||
          env.OPENX_IDENTITY_REGISTRY_ADDRESS ||
          configured.identity?.registryAddress ||
          DEFAULT_BLOCKCHAIN_CONFIG.identity.registryAddress
        ).trim(),
        verifyOnStartup: parseBoolean(
          overrides.identity?.verifyOnStartup ?? env.OPENX_BLOCKCHAIN_IDENTITY_VERIFY_ON_STARTUP ?? configured.identity?.verifyOnStartup,
          DEFAULT_BLOCKCHAIN_CONFIG.identity.verifyOnStartup
        ),
        autoRegister: parseBoolean(
          overrides.identity?.autoRegister ?? env.OPENX_BLOCKCHAIN_IDENTITY_AUTO_REGISTER ?? configured.identity?.autoRegister,
          DEFAULT_BLOCKCHAIN_CONFIG.identity.autoRegister
        ),
        registrationRetryAttempts: parseNumber(
          overrides.identity?.registrationRetryAttempts || env.OPENX_BLOCKCHAIN_IDENTITY_RETRY_ATTEMPTS || configured.identity?.registrationRetryAttempts,
          DEFAULT_BLOCKCHAIN_CONFIG.identity.registrationRetryAttempts,
          1,
          10
        ),
        registrationRetryBaseDelayMs: parseNumber(
          overrides.identity?.registrationRetryBaseDelayMs || env.OPENX_BLOCKCHAIN_IDENTITY_RETRY_BASE_DELAY_MS || configured.identity?.registrationRetryBaseDelayMs,
          DEFAULT_BLOCKCHAIN_CONFIG.identity.registrationRetryBaseDelayMs,
          0,
          60000
        ),
        registrationRetryMaxDelayMs: parseNumber(
          overrides.identity?.registrationRetryMaxDelayMs || env.OPENX_BLOCKCHAIN_IDENTITY_RETRY_MAX_DELAY_MS || configured.identity?.registrationRetryMaxDelayMs,
          DEFAULT_BLOCKCHAIN_CONFIG.identity.registrationRetryMaxDelayMs,
          0,
          120000
        )
      },
      pairing: {
        enabled: parseBoolean(
          overrides.pairing?.enabled ?? env.OPENX_BLOCKCHAIN_PAIRING_ENABLED ?? configured.pairing?.enabled,
          DEFAULT_BLOCKCHAIN_CONFIG.pairing.enabled
        ),
        registryAddress: String(
          overrides.pairing?.registryAddress ||
          env.OPENX_PAIR_REGISTRY_ADDRESS ||
          configured.pairing?.registryAddress ||
          DEFAULT_BLOCKCHAIN_CONFIG.pairing.registryAddress
        ).trim(),
        pairLifetimeMs: parseNumber(
          overrides.pairing?.pairLifetimeMs || env.OPENX_BLOCKCHAIN_PAIR_LIFETIME_MS || configured.pairing?.pairLifetimeMs,
          DEFAULT_BLOCKCHAIN_CONFIG.pairing.pairLifetimeMs,
          30000,
          900000
        ),
        retryDelayMs: parseNumber(
          overrides.pairing?.retryDelayMs || env.OPENX_BLOCKCHAIN_PAIR_RETRY_DELAY_MS || configured.pairing?.retryDelayMs,
          DEFAULT_BLOCKCHAIN_CONFIG.pairing.retryDelayMs,
          0,
          60000
        ),
        verificationTimeoutMs: parseNumber(
          overrides.pairing?.verificationTimeoutMs || env.OPENX_BLOCKCHAIN_PAIR_VERIFICATION_TIMEOUT_MS || configured.pairing?.verificationTimeoutMs,
          DEFAULT_BLOCKCHAIN_CONFIG.pairing.verificationTimeoutMs,
          1000,
          120000
        ),
        approvalTimeoutMs: parseNumber(
          overrides.pairing?.approvalTimeoutMs || env.OPENX_BLOCKCHAIN_PAIR_APPROVAL_TIMEOUT_MS || configured.pairing?.approvalTimeoutMs,
          DEFAULT_BLOCKCHAIN_CONFIG.pairing.approvalTimeoutMs,
          1000,
          300000
        ),
        synchronizationTimeoutMs: parseNumber(
          overrides.pairing?.synchronizationTimeoutMs || env.OPENX_BLOCKCHAIN_PAIR_SYNC_TIMEOUT_MS || configured.pairing?.synchronizationTimeoutMs,
          DEFAULT_BLOCKCHAIN_CONFIG.pairing.synchronizationTimeoutMs,
          1000,
          120000
        )
      },
      trust: {
        enabled: parseBoolean(
          overrides.trust?.enabled ?? env.OPENX_BLOCKCHAIN_TRUST_ENABLED ?? configured.trust?.enabled,
          DEFAULT_BLOCKCHAIN_CONFIG.trust.enabled
        ),
        registryAddress: String(
          overrides.trust?.registryAddress ||
          env.OPENX_TRUST_REGISTRY_ADDRESS ||
          configured.trust?.registryAddress ||
          DEFAULT_BLOCKCHAIN_CONFIG.trust.registryAddress
        ).trim(),
        cacheTtlMs: parseNumber(
          overrides.trust?.cacheTtlMs || env.OPENX_BLOCKCHAIN_TRUST_CACHE_TTL_MS || configured.trust?.cacheTtlMs,
          DEFAULT_BLOCKCHAIN_CONFIG.trust.cacheTtlMs,
          60000,
          30 * 24 * 60 * 60 * 1000
        ),
        backgroundRefreshMs: parseNumber(
          overrides.trust?.backgroundRefreshMs || env.OPENX_BLOCKCHAIN_TRUST_BACKGROUND_REFRESH_MS || configured.trust?.backgroundRefreshMs,
          DEFAULT_BLOCKCHAIN_CONFIG.trust.backgroundRefreshMs,
          60000,
          24 * 60 * 60 * 1000
        ),
        offlinePolicy: String(overrides.trust?.offlinePolicy || env.OPENX_BLOCKCHAIN_TRUST_OFFLINE_POLICY || configured.trust?.offlinePolicy || DEFAULT_BLOCKCHAIN_CONFIG.trust.offlinePolicy),
        allowUnknownWhenNoRegistry: parseBoolean(
          overrides.trust?.allowUnknownWhenNoRegistry ?? env.OPENX_BLOCKCHAIN_TRUST_ALLOW_UNKNOWN_NO_REGISTRY ?? configured.trust?.allowUnknownWhenNoRegistry,
          DEFAULT_BLOCKCHAIN_CONFIG.trust.allowUnknownWhenNoRegistry
        ),
        strict: parseBoolean(
          overrides.trust?.strict ?? env.OPENX_BLOCKCHAIN_TRUST_STRICT ?? configured.trust?.strict,
          DEFAULT_BLOCKCHAIN_CONFIG.trust.strict
        )
      },
      permissions: {
        enabled: parseBoolean(
          overrides.permissions?.enabled ?? env.OPENX_BLOCKCHAIN_PERMISSIONS_ENABLED ?? configured.permissions?.enabled,
          DEFAULT_BLOCKCHAIN_CONFIG.permissions.enabled
        ),
        registryAddress: String(
          overrides.permissions?.registryAddress ||
          env.OPENX_PERMISSION_REGISTRY_ADDRESS ||
          configured.permissions?.registryAddress ||
          DEFAULT_BLOCKCHAIN_CONFIG.permissions.registryAddress
        ).trim(),
        cacheTtlMs: parseNumber(
          overrides.permissions?.cacheTtlMs || env.OPENX_BLOCKCHAIN_PERMISSION_CACHE_TTL_MS || configured.permissions?.cacheTtlMs,
          DEFAULT_BLOCKCHAIN_CONFIG.permissions.cacheTtlMs,
          60000,
          30 * 24 * 60 * 60 * 1000
        ),
        backgroundRefreshMs: parseNumber(
          overrides.permissions?.backgroundRefreshMs || env.OPENX_BLOCKCHAIN_PERMISSION_BACKGROUND_REFRESH_MS || configured.permissions?.backgroundRefreshMs,
          DEFAULT_BLOCKCHAIN_CONFIG.permissions.backgroundRefreshMs,
          60000,
          24 * 60 * 60 * 1000
        ),
        offlinePolicy: String(overrides.permissions?.offlinePolicy || env.OPENX_BLOCKCHAIN_PERMISSION_OFFLINE_POLICY || configured.permissions?.offlinePolicy || DEFAULT_BLOCKCHAIN_CONFIG.permissions.offlinePolicy),
        allowUnknownWhenNoRegistry: parseBoolean(
          overrides.permissions?.allowUnknownWhenNoRegistry ?? env.OPENX_BLOCKCHAIN_PERMISSION_ALLOW_UNKNOWN_NO_REGISTRY ?? configured.permissions?.allowUnknownWhenNoRegistry,
          DEFAULT_BLOCKCHAIN_CONFIG.permissions.allowUnknownWhenNoRegistry
        ),
        strict: parseBoolean(
          overrides.permissions?.strict ?? env.OPENX_BLOCKCHAIN_PERMISSION_STRICT ?? configured.permissions?.strict,
          DEFAULT_BLOCKCHAIN_CONFIG.permissions.strict
        )
      }
    };

    ConfigManager.validate(config);
    return Object.freeze(config);
  }

  static validate(config = {}) {
    if (!Object.prototype.hasOwnProperty.call(BLOCKCHAIN_NETWORKS, config.network)) {
      throw new ConfigurationError('Unsupported blockchain network.', {
        code: 'BLOCKCHAIN_NETWORK_UNSUPPORTED',
        details: { network: config.network }
      });
    }
    normalizeUrl(config.rpcUrl, 'Blockchain RPC URL');
    if (!Number.isSafeInteger(Number(config.chainId)) || Number(config.chainId) <= 0) {
      throw new ConfigurationError('Blockchain chain ID must be a positive integer.', {
        code: 'BLOCKCHAIN_CHAIN_ID_INVALID'
      });
    }
    if (config.identity?.registryAddress && !/^0x[a-fA-F0-9]{40}$/.test(config.identity.registryAddress)) {
      throw new ConfigurationError('Identity registry contract address is invalid.', {
        code: 'BLOCKCHAIN_IDENTITY_REGISTRY_ADDRESS_INVALID'
      });
    }
    if (config.pairing?.registryAddress && !/^0x[a-fA-F0-9]{40}$/.test(config.pairing.registryAddress)) {
      throw new ConfigurationError('Pair registry contract address is invalid.', {
        code: 'BLOCKCHAIN_PAIR_REGISTRY_ADDRESS_INVALID'
      });
    }
    if (config.trust?.registryAddress && !/^0x[a-fA-F0-9]{40}$/.test(config.trust.registryAddress)) {
      throw new ConfigurationError('Trust registry contract address is invalid.', {
        code: 'BLOCKCHAIN_TRUST_REGISTRY_ADDRESS_INVALID'
      });
    }
    if (config.permissions?.registryAddress && !/^0x[a-fA-F0-9]{40}$/.test(config.permissions.registryAddress)) {
      throw new ConfigurationError('Permission registry contract address is invalid.', {
        code: 'BLOCKCHAIN_PERMISSION_REGISTRY_ADDRESS_INVALID'
      });
    }
    return true;
  }
}

module.exports = ConfigManager;
