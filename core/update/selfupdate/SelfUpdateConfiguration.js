function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clampInteger(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function normalizeStringArray(value, fallback = []) {
  const source = Array.isArray(value) ? value : fallback;
  return source
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 20);
}

const DEFAULT_SELF_UPDATE_CONFIGURATION = Object.freeze({
  enabled: true,
  silentInstallationEnabled: true,
  restartAfterInstall: true,
  preserveSession: true,
  futureAutomaticRestart: false,
  loggingEnabled: true,
  diagnosticsEnabled: true,
  monitorTimeoutMs: 15 * 60 * 1000,
  restartWaitMs: 1500,
  historyLimit: 50,
  allowedExtensions: ['.exe', '.msi'],
  silentArgs: Object.freeze({
    exe: ['/S'],
    msi: ['/qn', '/norestart']
  })
});

class SelfUpdateConfiguration {
  constructor(input = {}) {
    const source = isPlainObject(input) ? input : {};
    const defaults = DEFAULT_SELF_UPDATE_CONFIGURATION;
    const silentArgs = isPlainObject(source.silentArgs) ? source.silentArgs : {};
    this.enabled = source.enabled !== false;
    this.silentInstallationEnabled = source.silentInstallationEnabled !== false;
    this.restartAfterInstall = source.restartAfterInstall !== false;
    this.preserveSession = source.preserveSession !== false;
    this.futureAutomaticRestart = source.futureAutomaticRestart === true;
    this.loggingEnabled = source.loggingEnabled !== false;
    this.diagnosticsEnabled = source.diagnosticsEnabled !== false;
    this.monitorTimeoutMs = clampInteger(source.monitorTimeoutMs, 30 * 1000, 60 * 60 * 1000, defaults.monitorTimeoutMs);
    this.restartWaitMs = clampInteger(source.restartWaitMs, 0, 30 * 1000, defaults.restartWaitMs);
    this.historyLimit = clampInteger(source.historyLimit, 1, 500, defaults.historyLimit);
    this.allowedExtensions = normalizeStringArray(source.allowedExtensions, defaults.allowedExtensions)
      .map(item => item.toLowerCase())
      .filter(item => /^\.[a-z0-9]+$/.test(item))
      .slice(0, 8);
    this.silentArgs = Object.freeze({
      exe: normalizeStringArray(silentArgs.exe, defaults.silentArgs.exe),
      msi: normalizeStringArray(silentArgs.msi, defaults.silentArgs.msi)
    });
    Object.freeze(this);
  }

  toJSON() {
    return {
      enabled: this.enabled,
      silentInstallationEnabled: this.silentInstallationEnabled,
      restartAfterInstall: this.restartAfterInstall,
      preserveSession: this.preserveSession,
      futureAutomaticRestart: this.futureAutomaticRestart,
      loggingEnabled: this.loggingEnabled,
      diagnosticsEnabled: this.diagnosticsEnabled,
      monitorTimeoutMs: this.monitorTimeoutMs,
      restartWaitMs: this.restartWaitMs,
      historyLimit: this.historyLimit,
      allowedExtensions: this.allowedExtensions.slice(),
      silentArgs: {
        exe: this.silentArgs.exe.slice(),
        msi: this.silentArgs.msi.slice()
      }
    };
  }

  static defaults() {
    return new SelfUpdateConfiguration(DEFAULT_SELF_UPDATE_CONFIGURATION);
  }
}

module.exports = {
  DEFAULT_SELF_UPDATE_CONFIGURATION,
  SelfUpdateConfiguration
};
