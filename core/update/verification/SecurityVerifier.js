const VerificationPolicy = require('./VerificationPolicy');
const VersionManager = require('../VersionManager');

class SecurityVerifier {
  constructor(options = {}) {
    this.configuration = options.configuration;
    this.versionManager = options.versionManager || new VersionManager(options);
  }

  verify(context) {
    const startedAt = Date.now();
    try {
      const policy = new VerificationPolicy({
        allowedArchitectures: this.configuration.allowedArchitectures,
        allowedChannels: this.configuration.allowedChannels,
        requireSignature: this.configuration.strictSignatureMode,
        ...(context.policy || {})
      });
      const architecture = String(context.metadata.architecture || 'any').toLowerCase();
      const channel = String(context.manifest.channel || 'stable').toLowerCase();
      if (policy.allowedArchitectures && !policy.allowedArchitectures.includes(architecture) && !policy.allowedArchitectures.includes('any')) {
        throw this.error('POLICY_ARCHITECTURE_REJECTED', 'Package architecture is not allowed by policy.');
      }
      if (policy.allowedChannels && !policy.allowedChannels.includes(channel)) {
        throw this.error('POLICY_CHANNEL_REJECTED', 'Release channel is not allowed by policy.');
      }
      if (policy.requireSignature && context.signature.status !== 'Valid') {
        throw this.error('POLICY_SIGNATURE_REQUIRED', 'Policy requires a valid digital signature.');
      }
      const version = String(context.manifest.version || context.manifest.latestVersion || '').trim();
      if (policy.minimumSupportedVersion && version && this.versionManager.isOlder(version, policy.minimumSupportedVersion)) {
        throw this.error('POLICY_MIN_VERSION_REJECTED', 'Package version is below policy minimum.');
      }
      if (policy.maximumSupportedVersion && version && this.versionManager.isNewer(version, policy.maximumSupportedVersion)) {
        throw this.error('POLICY_MAX_VERSION_REJECTED', 'Package version is above policy maximum.');
      }
      return context.addCheck('policy', true, {
        architecture,
        channel,
        requireSignature: policy.requireSignature,
        certificatePinningPrepared: true,
        publisherAllowlistPrepared: true,
        revocationPrepared: true
      }, null, Date.now() - startedAt);
    } catch (error) {
      return context.addCheck('policy', false, {}, error, Date.now() - startedAt);
    }
  }

  error(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }
}

module.exports = SecurityVerifier;
