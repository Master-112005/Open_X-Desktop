const { chatDataPath } = require('../ChatDataPaths');

/**
 * Desktop Phase 12 file-transfer configuration.
 */
class TransferConfiguration {
  /**
   * Creates transfer configuration.
   * @param {object} options Overrides.
   */
  constructor(options = {}) {
    this.apiBaseUrl = String(options.apiBaseUrl || process.env.OPENX_CHAT_API_URL || 'https://openx-chat-server.onrender.com').replace(/\/+$/, '');
    this.maxImageSizeBytes = Number(options.maxImageSizeBytes || 10 * 1024 * 1024);
    this.maxDocumentSizeBytes = Number(options.maxDocumentSizeBytes || 15 * 1024 * 1024);
    this.maxRetries = Number(options.maxRetries || 5);
    this.retryBaseDelayMs = Number(options.retryBaseDelayMs || 1000);
    this.retryMaxDelayMs = Number(options.retryMaxDelayMs || 60000);
    this.thumbnailMaxDimension = Number(options.thumbnailMaxDimension || 320);
    this.storagePath = options.storagePath || chatDataPath('chat-file-transfers.json', { ...options, pathKey: 'chatFileTransfersPath' });
    this.encryptionVersion = String(options.encryptionVersion || 'phase4-aes-256-gcm');
    this.supportedImageExtensions = Object.freeze(options.supportedImageExtensions || ['jpg', 'jpeg', 'png', 'webp', 'gif']);
    this.supportedDocumentExtensions = Object.freeze(options.supportedDocumentExtensions || ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt']);
    this.blockedExtensions = Object.freeze(options.blockedExtensions || ['exe', 'dll', 'bat', 'apk', 'iso', 'zip', 'rar', '7z', 'mp3', 'mp4', 'avi']);
    this.mimeByExtension = Object.freeze(options.mimeByExtension || {
      jpg: ['image/jpeg'],
      jpeg: ['image/jpeg'],
      png: ['image/png'],
      webp: ['image/webp'],
      gif: ['image/gif'],
      pdf: ['application/pdf'],
      doc: ['application/msword', 'application/vnd.ms-word'],
      docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      txt: ['text/plain'],
      rtf: ['application/rtf', 'text/rtf'],
      odt: ['application/vnd.oasis.opendocument.text']
    });
    this.validate();
    Object.freeze(this);
  }

  /**
   * Validates config.
   */
  validate() {
    if (!/^https?:\/\//i.test(this.apiBaseUrl)) throw new Error('Transfer API base URL must be http:// or https://.');
    if (this.maxImageSizeBytes < 1 || this.maxDocumentSizeBytes < 1) throw new Error('Transfer file limits must be positive.');
    if (this.maxRetries < 0) throw new Error('Transfer retries must be >= 0.');
  }
}

module.exports = TransferConfiguration;
