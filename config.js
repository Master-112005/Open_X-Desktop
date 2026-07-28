const path = require('path');
const { buildDataPaths, resolveLegacyDataRoot } = require('./core/assistant/Data');
const packageJson = require('./package.json');

const DATA_PATHS = buildDataPaths();
const LEGACY_DATA_DIR = resolveLegacyDataRoot();

function envPath(name) {
  return process.env[name] || '';
}

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
    apiBaseUrl: 'https://openx-chat-server.onrender.com',
    defaultCountryCode: '',
    maxHistory: 300,
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
      chrome: envPath('OPENX_CHROME_PATH'),
      edge: envPath('OPENX_EDGE_PATH'),
      firefox: envPath('OPENX_FIREFOX_PATH')
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
    retryQueueMaxItems: 100,
    fileTransferChunkBytes: 12288,
    fileTransferTimeoutMs: 10 * 60 * 1000
  },

  communication: {
    defaultProvider: '',
    autoStart: true,
    debug: false,
    operationTimeoutMs: 8000
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
