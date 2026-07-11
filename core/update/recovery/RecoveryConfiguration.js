function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clampInteger(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

const DEFAULT_RECOVERY_CONFIGURATION = Object.freeze({
  enabled: true,
  automaticRollback: true,
  startupValidationEnabled: true,
  maxRecoveryAttempts: 1,
  startupTimeoutMs: 2 * 60 * 1000,
  healthTimeoutMs: 30 * 1000,
  loggingEnabled: true,
  diagnosticsEnabled: true,
  historyLimit: 50,
  backup: Object.freeze({
    singleGeneration: true,
    includeLogs: false,
    excludeNames: ['node_modules', 'cache', 'logs', 'tmp', 'temp', 'downloads']
  })
});

class RecoveryConfiguration {
  constructor(input = {}) {
    const source = isPlainObject(input) ? input : {};
    const backup = isPlainObject(source.backup) ? source.backup : {};
    this.enabled = source.enabled !== false;
    this.automaticRollback = source.automaticRollback !== false;
    this.startupValidationEnabled = source.startupValidationEnabled !== false;
    this.maxRecoveryAttempts = clampInteger(source.maxRecoveryAttempts, 1, 3, DEFAULT_RECOVERY_CONFIGURATION.maxRecoveryAttempts);
    this.startupTimeoutMs = clampInteger(source.startupTimeoutMs, 5 * 1000, 10 * 60 * 1000, DEFAULT_RECOVERY_CONFIGURATION.startupTimeoutMs);
    this.healthTimeoutMs = clampInteger(source.healthTimeoutMs, 5 * 1000, 5 * 60 * 1000, DEFAULT_RECOVERY_CONFIGURATION.healthTimeoutMs);
    this.loggingEnabled = source.loggingEnabled !== false;
    this.diagnosticsEnabled = source.diagnosticsEnabled !== false;
    this.historyLimit = clampInteger(source.historyLimit, 1, 500, DEFAULT_RECOVERY_CONFIGURATION.historyLimit);
    this.backup = Object.freeze({
      singleGeneration: backup.singleGeneration !== false,
      includeLogs: backup.includeLogs === true,
      excludeNames: (Array.isArray(backup.excludeNames) ? backup.excludeNames : DEFAULT_RECOVERY_CONFIGURATION.backup.excludeNames)
        .map(item => String(item || '').trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 30)
    });
    Object.freeze(this);
  }

  toJSON() {
    return {
      enabled: this.enabled,
      automaticRollback: this.automaticRollback,
      startupValidationEnabled: this.startupValidationEnabled,
      maxRecoveryAttempts: this.maxRecoveryAttempts,
      startupTimeoutMs: this.startupTimeoutMs,
      healthTimeoutMs: this.healthTimeoutMs,
      loggingEnabled: this.loggingEnabled,
      diagnosticsEnabled: this.diagnosticsEnabled,
      historyLimit: this.historyLimit,
      backup: {
        singleGeneration: this.backup.singleGeneration,
        includeLogs: this.backup.includeLogs,
        excludeNames: this.backup.excludeNames.slice()
      }
    };
  }
}

module.exports = {
  DEFAULT_RECOVERY_CONFIGURATION,
  RecoveryConfiguration
};
