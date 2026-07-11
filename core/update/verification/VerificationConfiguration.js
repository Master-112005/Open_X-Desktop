const DEFAULT_VERIFICATION_CONFIGURATION = Object.freeze({
  enabled: true,
  strictSignatureMode: false,
  strictManifestMode: true,
  strictVersionChecking: true,
  strictSecurityPolicy: true,
  futureCertificatePinning: false,
  allowedExtensions: ['.exe', '.msi', '.zip', '.bin'],
  allowedArchitectures: ['x64', 'arm64', 'ia32', 'any'],
  allowedChannels: ['stable', 'beta', 'alpha', 'nightly'],
  minimumBytes: 1,
  maximumBytes: 10 * 1024 * 1024 * 1024,
  loggingEnabled: true,
  diagnosticsEnabled: true
});

function normalizeList(value, fallback) {
  const list = Array.isArray(value) ? value : fallback;
  return list.map(item => String(item || '').trim().toLowerCase()).filter(Boolean);
}

class VerificationConfiguration {
  constructor(input = {}) {
    const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    this.enabled = source.enabled !== false;
    this.strictSignatureMode = source.strictSignatureMode === true;
    this.strictManifestMode = source.strictManifestMode !== false;
    this.strictVersionChecking = source.strictVersionChecking !== false;
    this.strictSecurityPolicy = source.strictSecurityPolicy !== false;
    this.futureCertificatePinning = source.futureCertificatePinning === true;
    this.allowedExtensions = normalizeList(source.allowedExtensions, DEFAULT_VERIFICATION_CONFIGURATION.allowedExtensions);
    this.allowedArchitectures = normalizeList(source.allowedArchitectures, DEFAULT_VERIFICATION_CONFIGURATION.allowedArchitectures);
    this.allowedChannels = normalizeList(source.allowedChannels, DEFAULT_VERIFICATION_CONFIGURATION.allowedChannels);
    this.minimumBytes = Math.max(0, Number(source.minimumBytes ?? DEFAULT_VERIFICATION_CONFIGURATION.minimumBytes) || 0);
    this.maximumBytes = Math.max(this.minimumBytes, Number(source.maximumBytes || DEFAULT_VERIFICATION_CONFIGURATION.maximumBytes));
    this.loggingEnabled = source.loggingEnabled !== false;
    this.diagnosticsEnabled = source.diagnosticsEnabled !== false;
    Object.freeze(this);
  }

  toJSON() {
    return {
      enabled: this.enabled,
      strictSignatureMode: this.strictSignatureMode,
      strictManifestMode: this.strictManifestMode,
      strictVersionChecking: this.strictVersionChecking,
      strictSecurityPolicy: this.strictSecurityPolicy,
      futureCertificatePinning: this.futureCertificatePinning,
      allowedExtensions: this.allowedExtensions.slice(),
      allowedArchitectures: this.allowedArchitectures.slice(),
      allowedChannels: this.allowedChannels.slice(),
      minimumBytes: this.minimumBytes,
      maximumBytes: this.maximumBytes,
      loggingEnabled: this.loggingEnabled,
      diagnosticsEnabled: this.diagnosticsEnabled
    };
  }
}

module.exports = {
  DEFAULT_VERIFICATION_CONFIGURATION,
  VerificationConfiguration
};
