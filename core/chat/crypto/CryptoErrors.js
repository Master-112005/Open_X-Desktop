/**
 * Error raised by Desktop Chat cryptographic infrastructure.
 */
class CryptoError extends Error {
  /**
   * Creates a crypto error.
   * @param {string} code Stable error code.
   * @param {string} message Human readable message.
   * @param {object} details Safe details.
   */
  constructor(code, message, details = null) {
    super(message);
    this.name = 'CryptoError';
    this.code = code;
    this.details = details;
  }
}

module.exports = CryptoError;
