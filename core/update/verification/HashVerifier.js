const crypto = require('crypto');
const fs = require('fs');

class HashVerifier {
  verify(context) {
    const startedAt = Date.now();
    try {
      const calculated = crypto.createHash('sha256').update(fs.readFileSync(context.filePath)).digest('hex');
      const expected = String(context.manifest.sha256 || context.manifest.checksum || context.manifest.hash || '').trim().toLowerCase();
      if (!expected && context.configuration.strictManifestMode) {
        throw this.error('SHA256_MISSING', 'Manifest SHA256 is required.');
      }
      if (expected && calculated !== expected) {
        throw this.error('SHA256_MISMATCH', 'Downloaded package SHA256 does not match manifest.');
      }
      context.hash = { algorithm: 'sha256', calculated, expected: expected || null };
      return context.addCheck('sha256', true, context.hash, null, Date.now() - startedAt);
    } catch (error) {
      return context.addCheck('sha256', false, {}, error, Date.now() - startedAt);
    }
  }

  error(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }
}

module.exports = HashVerifier;
