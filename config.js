const path = require('path');
const os = require('os');
const { buildDataPaths } = require('./core/assistant/Data');
const packageJson = require('./package.json');

const DATA_PATHS = buildDataPaths();
const LEGACY_DATA_DIR = path.join(os.homedir(), '.jarvis');

const CONFIG = {
  app: {
    name: 'OpenX',
    version: packageJson.version,
    dataDir: DATA_PATHS.root,
    dataPaths: DATA_PATHS,
    legacyDataDir: LEGACY_DATA_DIR,
    migrateLegacyData: true,
    migrateCwdSchedules: true,
    migrateCwdPlanner: true
  },

  voice: {
    activationShortcut: 'Alt+Space',
    activationFallbackShortcuts: [],
    tts: {
      rate: 2,
      volume: 100,
      voiceName: '',
      naturalize: true
    }
  },

  assistant: {
    displayName: 'OpenX',
    title: 'Desktop Assistant',
    honorific: 'sir',
    userProfile: {
      fullName: '',
      email: '',
      phone: '',
      addressLine1: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
      company: '',
      role: ''
    }
  },

  activeLearning: {
    enabled: true,
    askForFeedback: true,
    storePath: DATA_PATHS.learningPath
  },

  permissions: {
    levels: {
      low: { requiresConfirmation: false, requiresAuth: false },
      medium: { requiresConfirmation: true, requiresAuth: false },
      high: { requiresConfirmation: true, requiresAuth: true },
      critical: { requiresConfirmation: true, requiresAuth: true }
    },
    maxFailedAttempts: 3,
    authTimeoutMs: 30000
  },

  chat: {
    activationShortcut: 'Control+Space',
    activationFallbackShortcuts: [],
    maxHistory: 250,
    maxDisplayMessages: 250,
    fontSize: 14,
    fontFamily: 'Segoe UI, sans-serif',
    activeTheme: 'graphite',
    glassTint: 42,
    theme: {
      dark: {
        background: '#1a1a2e',
        text: '#e0e0e0',
        userBubble: '#0f3460',
        assistantBubble: '#16213e',
        inputBg: '#0f0f23',
        border: '#2a2a4a'
      },
      light: {
        background: '#ffffff',
        text: '#333333',
        userBubble: '#e3f2fd',
        assistantBubble: '#f5f5f5',
        inputBg: '#fafafa',
        border: '#e0e0e0'
      }
    }
  },

  system: {
    pollingIntervalMs: 5000,
    volumeStep: 5,
    brightnessStep: 10,
    maxRecentApps: 20,
    browserPaths: {
      chrome: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      edge: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      firefox: 'C:\\Program Files\\Mozilla Firefox\\firefox.exe'
    }
  },

  cloud: {
    relayUrl: process.env.OPENX_RELAY_URL || 'wss://openx-server.onrender.com/ws',
    connectionTimeoutMs: 10000,
    heartbeatIntervalMs: 30000,
    pairTokenTtlMs: 5 * 60 * 1000,
    commandExecutionTimeoutMs: 60000,
    commandQueueMode: 'queue',
    commandMaxQueueSize: 25,
    fileTransferChunkBytes: 12288,
    fileTransferTimeoutMs: 10 * 60 * 1000
  },

  communication: {
    defaultProvider: '',
    autoStart: true,
    debug: false,
    operationTimeoutMs: 8000
  },

  blockchain: {
    enabled: process.env.OPENX_BLOCKCHAIN_ENABLED === 'true',
    network: process.env.OPENX_BLOCKCHAIN_NETWORK || 'fuji',
    requestTimeoutMs: Number(process.env.OPENX_BLOCKCHAIN_REQUEST_TIMEOUT_MS) || 8000,
    connectionTimeoutMs: Number(process.env.OPENX_BLOCKCHAIN_CONNECTION_TIMEOUT_MS) || 8000,
    healthIntervalMs: Number(process.env.OPENX_BLOCKCHAIN_HEALTH_INTERVAL_MS) || 30000,
    retry: {
      attempts: Number(process.env.OPENX_BLOCKCHAIN_RETRY_ATTEMPTS) || 3,
      baseDelayMs: Number(process.env.OPENX_BLOCKCHAIN_RETRY_BASE_DELAY_MS) || 500,
      maxDelayMs: Number(process.env.OPENX_BLOCKCHAIN_RETRY_MAX_DELAY_MS) || 5000
    },
    gas: {
      maxFeePerGasGwei: Number(process.env.OPENX_BLOCKCHAIN_MAX_FEE_GWEI) || 50,
      maxPriorityFeePerGasGwei: Number(process.env.OPENX_BLOCKCHAIN_PRIORITY_FEE_GWEI) || 2,
      gasLimitMultiplier: Number(process.env.OPENX_BLOCKCHAIN_GAS_LIMIT_MULTIPLIER) || 1.2
    },
    identity: {
      enabled: process.env.OPENX_BLOCKCHAIN_IDENTITY_ENABLED !== 'false',
      deviceType: process.env.OPENX_BLOCKCHAIN_DEVICE_TYPE || 'desktop',
      registryAddress: process.env.OPENX_IDENTITY_REGISTRY_ADDRESS || '',
      verifyOnStartup: process.env.OPENX_BLOCKCHAIN_IDENTITY_VERIFY_ON_STARTUP !== 'false',
      autoRegister: process.env.OPENX_BLOCKCHAIN_IDENTITY_AUTO_REGISTER !== 'false',
      registrationRetryAttempts: Number(process.env.OPENX_BLOCKCHAIN_IDENTITY_RETRY_ATTEMPTS) || 3,
      registrationRetryBaseDelayMs: Number(process.env.OPENX_BLOCKCHAIN_IDENTITY_RETRY_BASE_DELAY_MS) || 1000,
      registrationRetryMaxDelayMs: Number(process.env.OPENX_BLOCKCHAIN_IDENTITY_RETRY_MAX_DELAY_MS) || 10000
    },
    pairing: {
      enabled: process.env.OPENX_BLOCKCHAIN_PAIRING_ENABLED !== 'false',
      registryAddress: process.env.OPENX_PAIR_REGISTRY_ADDRESS || '',
      pairLifetimeMs: Number(process.env.OPENX_BLOCKCHAIN_PAIR_LIFETIME_MS) || 5 * 60 * 1000,
      retryDelayMs: Number(process.env.OPENX_BLOCKCHAIN_PAIR_RETRY_DELAY_MS) || 1000,
      verificationTimeoutMs: Number(process.env.OPENX_BLOCKCHAIN_PAIR_VERIFICATION_TIMEOUT_MS) || 15000,
      approvalTimeoutMs: Number(process.env.OPENX_BLOCKCHAIN_PAIR_APPROVAL_TIMEOUT_MS) || 60000,
      synchronizationTimeoutMs: Number(process.env.OPENX_BLOCKCHAIN_PAIR_SYNC_TIMEOUT_MS) || 15000
    },
    trust: {
      enabled: process.env.OPENX_BLOCKCHAIN_TRUST_ENABLED !== 'false',
      registryAddress: process.env.OPENX_TRUST_REGISTRY_ADDRESS || '',
      cacheTtlMs: Number(process.env.OPENX_BLOCKCHAIN_TRUST_CACHE_TTL_MS) || 24 * 60 * 60 * 1000,
      backgroundRefreshMs: Number(process.env.OPENX_BLOCKCHAIN_TRUST_BACKGROUND_REFRESH_MS) || 15 * 60 * 1000,
      offlinePolicy: process.env.OPENX_BLOCKCHAIN_TRUST_OFFLINE_POLICY || 'allow-valid-cache',
      allowUnknownWhenNoRegistry: process.env.OPENX_BLOCKCHAIN_TRUST_ALLOW_UNKNOWN_NO_REGISTRY !== 'false',
      strict: process.env.OPENX_BLOCKCHAIN_TRUST_STRICT === 'true'
    },
    permissions: {
      enabled: process.env.OPENX_BLOCKCHAIN_PERMISSIONS_ENABLED !== 'false',
      registryAddress: process.env.OPENX_PERMISSION_REGISTRY_ADDRESS || '',
      cacheTtlMs: Number(process.env.OPENX_BLOCKCHAIN_PERMISSION_CACHE_TTL_MS) || 24 * 60 * 60 * 1000,
      backgroundRefreshMs: Number(process.env.OPENX_BLOCKCHAIN_PERMISSION_BACKGROUND_REFRESH_MS) || 15 * 60 * 1000,
      offlinePolicy: process.env.OPENX_BLOCKCHAIN_PERMISSION_OFFLINE_POLICY || 'allow-valid-cache',
      allowUnknownWhenNoRegistry: process.env.OPENX_BLOCKCHAIN_PERMISSION_ALLOW_UNKNOWN_NO_REGISTRY !== 'false',
      strict: process.env.OPENX_BLOCKCHAIN_PERMISSION_STRICT === 'true'
    },
    networks: {
      fuji: {
        rpcUrl: process.env.OPENX_BLOCKCHAIN_FUJI_RPC_URL || process.env.OPENX_BLOCKCHAIN_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc',
        chainId: Number(process.env.OPENX_BLOCKCHAIN_CHAIN_ID) || 43113,
        explorerUrl: 'https://subnets-test.avax.network/c-chain',
        networkName: 'Avalanche Fuji C-Chain'
      },
      mainnet: {
        rpcUrl: process.env.OPENX_BLOCKCHAIN_MAINNET_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
        chainId: 43114,
        explorerUrl: 'https://subnets.avax.network/c-chain',
        networkName: 'Avalanche C-Chain'
      },
      local: {
        rpcUrl: process.env.OPENX_BLOCKCHAIN_LOCAL_RPC_URL || 'http://127.0.0.1:9650/ext/bc/C/rpc',
        chainId: Number(process.env.OPENX_BLOCKCHAIN_LOCAL_CHAIN_ID) || 43112,
        explorerUrl: process.env.OPENX_BLOCKCHAIN_LOCAL_EXPLORER_URL || '',
        networkName: 'Avalanche Local C-Chain'
      }
    }
  },

  visualMemory: {
    performance: {
      maxIndexDepth: 8,
      maxIndexFiles: 50000
    }
  },

  logging: {
    level: 'info',
    maxFileSize: 10485760,
    maxFiles: 5,
    directory: DATA_PATHS.logsDir
  },

  plugins: {
    directory: path.join(__dirname, 'plugins'),
    enabled: true,
    trustedPlugins: ['sample_plugin', 'youtube', 'chrome', 'discord']
  }
};

module.exports = CONFIG;
