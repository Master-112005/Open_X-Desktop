function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clampInteger(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

const DEFAULT_INSTALLATION_CONFIGURATION = Object.freeze({
  enabled: true,
  requireConfirmation: true,
  allowCancellation: true,
  preventDuplicateInstallations: true,
  confirmationTimeoutMs: 0,
  loggingEnabled: true,
  diagnosticsEnabled: true,
  allowedExtensions: ['.exe', '.msi'],
  allowedInstallerArgs: [],
  historyLimit: 50
});

class InstallationConfiguration {
  constructor(input = {}) {
    const source = isPlainObject(input) ? input : {};
    const defaults = DEFAULT_INSTALLATION_CONFIGURATION;
    this.enabled = source.enabled !== false;
    this.requireConfirmation = true;
    this.allowCancellation = source.allowCancellation !== false;
    this.preventDuplicateInstallations = source.preventDuplicateInstallations !== false;
    this.confirmationTimeoutMs = clampInteger(source.confirmationTimeoutMs, 0, 15 * 60 * 1000, defaults.confirmationTimeoutMs);
    this.loggingEnabled = source.loggingEnabled !== false;
    this.diagnosticsEnabled = source.diagnosticsEnabled !== false;
    this.allowedExtensions = (Array.isArray(source.allowedExtensions) ? source.allowedExtensions : defaults.allowedExtensions)
      .map(item => String(item || '').trim().toLowerCase())
      .filter(item => /^\.[a-z0-9]+$/.test(item))
      .slice(0, 8);
    this.allowedInstallerArgs = (Array.isArray(source.allowedInstallerArgs) ? source.allowedInstallerArgs : defaults.allowedInstallerArgs)
      .map(item => String(item || '').trim())
      .filter(Boolean)
      .slice(0, 20);
    this.historyLimit = clampInteger(source.historyLimit, 1, 500, defaults.historyLimit);
    Object.freeze(this);
  }

  toJSON() {
    return {
      enabled: this.enabled,
      requireConfirmation: this.requireConfirmation,
      allowCancellation: this.allowCancellation,
      preventDuplicateInstallations: this.preventDuplicateInstallations,
      confirmationTimeoutMs: this.confirmationTimeoutMs,
      loggingEnabled: this.loggingEnabled,
      diagnosticsEnabled: this.diagnosticsEnabled,
      allowedExtensions: this.allowedExtensions.slice(),
      allowedInstallerArgs: this.allowedInstallerArgs.slice(),
      historyLimit: this.historyLimit
    };
  }

  static defaults() {
    return new InstallationConfiguration(DEFAULT_INSTALLATION_CONFIGURATION);
  }
}

module.exports = {
  DEFAULT_INSTALLATION_CONFIGURATION,
  InstallationConfiguration
};
