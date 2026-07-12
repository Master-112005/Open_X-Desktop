const VersionManager = require('../VersionManager');

class VersionVerifier {
  constructor(options = {}) {
    this.versionManager = options.versionManager || new VersionManager(options);
    this.configuration = options.configuration;
  }

  verify(context) {
    const startedAt = Date.now();
    try {
      const manifestVersion = String(context.manifest.version || context.manifest.latestVersion || '').trim();
      const packageVersion = String(context.metadata.productVersion || context.metadata.fileVersion || '').trim();
      if (!manifestVersion && context.configuration.strictVersionChecking) throw this.error('MANIFEST_VERSION_MISSING', 'Manifest version is required.');
      if (manifestVersion && !this.versionManager.isValidVersion(manifestVersion)) throw this.error('INVALID_MANIFEST_VERSION', 'Manifest version is invalid.');
      if (packageVersion && !this.versionManager.isValidVersion(packageVersion)) throw this.error('INVALID_PACKAGE_VERSION', 'Package version is invalid.');
      if (manifestVersion && packageVersion && !this.versionManager.isEqual(packageVersion, manifestVersion)) {
        throw this.error('VERSION_MISMATCH', 'Package version does not match manifest version.');
      }
      if (context.currentVersion && manifestVersion && this.versionManager.isOlder(manifestVersion, context.currentVersion)) {
        throw this.error('DOWNGRADE_REJECTED', 'Package version is older than current application version.');
      }
      return context.addCheck('version', true, { manifestVersion, packageVersion, currentVersion: context.currentVersion || null }, null, Date.now() - startedAt);
    } catch (error) {
      return context.addCheck('version', false, {}, error, Date.now() - startedAt);
    }
  }

  error(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }
}

module.exports = VersionVerifier;
