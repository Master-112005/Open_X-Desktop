const CryptoError = require('./CryptoErrors');

/**
 * Validates crypto inputs and key material shapes.
 */
class CryptoValidation {
  /**
   * Validates a buffer.
   * @param {*} value Candidate buffer.
   * @param {number} length Required length.
   * @param {string} label Human label.
   * @returns {Buffer} Buffer.
   */
  buffer(value, length, label) {
    const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value || '');
    if (buffer.length !== length) throw new CryptoError('crypto.validation_failed', `${label} must be ${length} bytes.`);
    return buffer;
  }

  /**
   * Validates a PEM public key.
   * @param {string} pem PEM public key.
   * @returns {string} PEM.
   */
  publicKeyPem(pem) {
    const value = String(pem || '').trim();
    if (!/-----BEGIN PUBLIC KEY-----/.test(value)) throw new CryptoError('crypto.public_key_invalid', 'Public key PEM is invalid.');
    if (/PRIVATE KEY/.test(value)) throw new CryptoError('crypto.private_key_leak', 'Private key was provided where public key was expected.');
    return value;
  }

  /**
   * Validates a PEM private key.
   * @param {string} pem PEM private key.
   * @returns {string} PEM.
   */
  privateKeyPem(pem) {
    const value = String(pem || '').trim();
    if (!/-----BEGIN PRIVATE KEY-----/.test(value)) throw new CryptoError('crypto.private_key_invalid', 'Private key PEM is invalid.');
    return value;
  }

  /**
   * Validates fingerprint format.
   * @param {string} fingerprint Fingerprint.
   * @returns {string} Fingerprint.
   */
  fingerprint(fingerprint) {
    const value = String(fingerprint || '').trim();
    if (!/^fp:v1:sha256:[a-f0-9]{64}$/.test(value)) throw new CryptoError('crypto.fingerprint_invalid', 'Fingerprint is invalid.');
    return value;
  }
}

module.exports = CryptoValidation;
