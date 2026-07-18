const { chatDataPath } = require('../ChatDataPaths');

/**
 * Desktop contact request configuration.
 */
class RequestConfiguration {
  /**
   * Creates contact request configuration.
   * @param {object} options Configuration overrides.
   */
  constructor(options = {}) {
    this.apiBaseUrl = String(options.apiBaseUrl || process.env.OPENX_CHAT_API_URL || 'http://localhost:8090').replace(/\/+$/, '');
    this.requestTimeoutMs = Number(options.requestTimeoutMs || 15000);
    this.maxMessagePreviewLength = Number(options.maxMessagePreviewLength || 160);
    this.maxNicknameLength = Number(options.maxNicknameLength || 80);
    this.nicknameStatePath = options.nicknameStatePath || process.env.OPENX_CHAT_NICKNAME_STATE_PATH || chatDataPath('chat-request-nicknames.json', { ...options, pathKey: 'chatRequestNicknamesPath' });
    this.validate();
    Object.freeze(this);
  }

  /**
   * Validates configuration.
   */
  validate() {
    if (!/^https?:\/\//i.test(this.apiBaseUrl)) throw new Error('Contact request API base URL must be http:// or https://.');
    if (this.requestTimeoutMs < 1000) throw new Error('Contact request timeout is too small.');
    if (this.maxMessagePreviewLength < 0 || this.maxMessagePreviewLength > 1000) throw new Error('Contact request preview length is invalid.');
    if (this.maxNicknameLength < 1 || this.maxNicknameLength > 160) throw new Error('Contact request nickname length is invalid.');
  }
}

module.exports = RequestConfiguration;
