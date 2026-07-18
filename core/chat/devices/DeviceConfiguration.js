const os = require('os');
const { chatDataPath } = require('../ChatDataPaths');

/**
 * Desktop trusted device configuration.
 */
class DeviceConfiguration {
  /**
   * Creates device configuration.
   * @param {object} options Overrides.
   */
  constructor(options = {}) {
    this.apiBaseUrl = String(options.apiBaseUrl || process.env.OPENX_CHAT_API_URL || 'http://localhost:8090').replace(/\/+$/, '');
    this.accountId = options.accountId || process.env.OPENX_CHAT_ACCOUNT_ID || null;
    this.autoRegister = options.autoRegister !== false;
    this.deviceName = options.deviceName || `${os.hostname()} Desktop`;
    this.platform = options.platform || this.defaultPlatform();
    this.platformVersion = options.platformVersion || os.release();
    this.applicationVersion = options.applicationVersion || '0.1.0';
    this.operatingSystem = options.operatingSystem || `${os.type()} ${os.release()}`;
    this.deviceType = options.deviceType || 'Desktop';
    this.capabilities = Object.freeze(options.capabilities || ['persistentConnection', 'largeStorage', 'backgroundProcessing']);
    this.statePath = options.statePath || process.env.OPENX_CHAT_DEVICE_STATE_PATH || chatDataPath('chat-device.json', { ...options, pathKey: 'chatDevicePath' });
    this.requestTimeoutMs = Number(options.requestTimeoutMs || 15000);
    this.validate();
    Object.freeze(this);
  }

  /**
   * Validates configuration.
   */
  validate() {
    if (!/^https?:\/\//i.test(this.apiBaseUrl)) throw new Error('Device API base URL must be http:// or https://.');
    if (this.requestTimeoutMs < 1000) throw new Error('Device request timeout is too small.');
  }

  /**
   * Returns normalized platform name accepted by the chat server.
   * @returns {string} Platform.
   */
  defaultPlatform() {
    if (process.platform === 'win32') return 'windows';
    if (process.platform === 'darwin') return 'macos';
    if (process.platform === 'linux') return 'linux';
    return 'desktop';
  }
}

module.exports = DeviceConfiguration;
