class ManifestVerifier {
  verify(context) {
    const startedAt = Date.now();
    try {
      const manifest = context.manifest || {};
      if (context.configuration.strictManifestMode && !Object.keys(manifest).length) {
        throw this.error('MANIFEST_MISSING', 'Verification manifest is required.');
      }
      const checks = {
        version: manifest.version || manifest.latestVersion || null,
        sha256: manifest.sha256 || manifest.checksum || null,
        size: manifest.size || manifest.fileSize || manifest.bytes || null,
        architecture: String(manifest.architecture || manifest.arch || context.metadata.architecture || 'any').toLowerCase(),
        platform: String(manifest.platform || context.metadata.platform || process.platform).toLowerCase(),
        channel: String(manifest.channel || 'stable').toLowerCase(),
        minimumVersion: manifest.minimumVersion || null,
        releaseStatus: String(manifest.releaseStatus || manifest.status || 'published').toLowerCase()
      };
      if (checks.sha256 && context.hash.calculated && checks.sha256.toLowerCase() !== context.hash.calculated) {
        throw this.error('MANIFEST_HASH_MISMATCH', 'Manifest SHA256 does not match locally calculated hash.');
      }
      if (checks.size && Number(checks.size) !== Number(context.file.size)) {
        throw this.error('MANIFEST_SIZE_MISMATCH', 'Manifest size does not match local file size.');
      }
      if (checks.releaseStatus && !['published', 'active', 'stable', 'released'].includes(checks.releaseStatus)) {
        throw this.error('MANIFEST_RELEASE_STATUS_REJECTED', 'Manifest release status is not allowed.');
      }
      return context.addCheck('manifest', true, checks, null, Date.now() - startedAt);
    } catch (error) {
      return context.addCheck('manifest', false, {}, error, Date.now() - startedAt);
    }
  }

  error(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }
}

module.exports = ManifestVerifier;
