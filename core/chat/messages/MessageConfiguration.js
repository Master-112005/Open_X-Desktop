const { chatDataPath } = require('../ChatDataPaths');

/**
 * Desktop Phase 8 message configuration.
 */
class MessageConfiguration {
  /**
   * Creates message configuration.
   * @param {object} options Configuration overrides.
   */
  constructor(options = {}) {
    this.apiBaseUrl = String(options.apiBaseUrl || process.env.OPENX_CHAT_API_URL || 'https://openx-chat-server.onrender.com').replace(/\/+$/, '');
    this.protocolVersion = String(options.protocolVersion || '1');
    this.maxMessageSizeBytes = Number(options.maxMessageSizeBytes || 65536);
    this.compressionThresholdBytes = Number(options.compressionThresholdBytes || 1024);
    this.maxQueueSize = Number(options.maxQueueSize || 1000);
    this.maxRetries = Number(options.maxRetries || 5);
    this.retryBaseDelayMs = Number(options.retryBaseDelayMs || 1000);
    this.retryMaxDelayMs = Number(options.retryMaxDelayMs || 60000);
    this.typingTimeoutMs = Number(options.typingTimeoutMs || 8000);
    this.ackTimeoutMs = Number(options.ackTimeoutMs || 30000);
    this.storagePath = options.storagePath || chatDataPath('chat-messages.json', { ...options, pathKey: 'chatMessagesPath' });
    this.requireSessionKey = options.requireSessionKey !== false;
    this.allowEphemeralSessionKey = options.allowEphemeralSessionKey === true && process.env.NODE_ENV !== 'production';
    this.supportedTypes = Object.freeze(options.supportedTypes || ['Text', 'Emoji']);
    this.compressionAlgorithms = Object.freeze(options.compressionAlgorithms || ['none', 'gzip']);
    this.encryptionVersion = String(options.encryptionVersion || 'phase4-aes-256-gcm');
    this.validate();
    Object.freeze(this);
  }

  /**
   * Validates configuration values.
   */
  validate() {
    if (this.maxMessageSizeBytes < 1) throw new Error('Message maximum size must be positive.');
    if (this.compressionThresholdBytes < 0) throw new Error('Message compression threshold is invalid.');
    if (this.maxRetries < 0) throw new Error('Message max retries must be >= 0.');
    if (!this.supportedTypes.every(type => ['Text', 'Emoji'].includes(type))) throw new Error('Only Text and Emoji are enabled in Phase 8.');
  }
}

module.exports = MessageConfiguration;
