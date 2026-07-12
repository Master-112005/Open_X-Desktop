function average(values = []) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

class SelfUpdateDiagnostics {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.successfulUpdates = 0;
    this.failedUpdates = 0;
    this.installerFailures = 0;
    this.restartFailures = 0;
    this.recoveryCount = 0;
    this.installationTimes = [];
    this.restartTimes = [];
    this.exitCodes = [];
    this.errors = [];
    this.lastInstalledVersion = '';
    this.lastUpdateDuration = 0;
  }

  mark(field) {
    if (!this.enabled) return;
    this[field] = Number(this[field] || 0) + 1;
  }

  addTiming(field, value) {
    if (!this.enabled) return;
    const list = this[field] || [];
    list.push(Math.max(0, Number(value) || 0));
    this[field] = list.slice(-50);
  }

  recordExitCode(code) {
    if (!this.enabled) return;
    this.exitCodes.push(code);
    this.exitCodes = this.exitCodes.slice(-50);
  }

  recordSuccess(session = {}) {
    if (!this.enabled) return;
    this.successfulUpdates += 1;
    this.lastInstalledVersion = session.targetVersion || session.installerVersion || this.lastInstalledVersion;
    this.lastUpdateDuration = Number(session.durationMs) || 0;
  }

  recordError(error) {
    if (!this.enabled) return;
    this.errors.unshift({
      message: String(error?.message || error),
      code: error?.code || null,
      at: new Date().toISOString()
    });
    this.errors = this.errors.slice(0, 25);
  }

  snapshot(status = {}) {
    return Object.freeze({
      enabled: this.enabled,
      counters: {
        successfulUpdates: this.successfulUpdates,
        failedUpdates: this.failedUpdates,
        installerFailures: this.installerFailures,
        restartFailures: this.restartFailures,
        recoveryCount: this.recoveryCount
      },
      timings: {
        installationTimes: this.installationTimes.slice(),
        restartTimes: this.restartTimes.slice(),
        averageInstallationTime: average(this.installationTimes),
        averageRestartTime: average(this.restartTimes)
      },
      exitCodes: this.exitCodes.slice(),
      lastInstalledVersion: this.lastInstalledVersion,
      lastUpdateDuration: this.lastUpdateDuration,
      errors: this.errors.slice(),
      status
    });
  }
}

module.exports = SelfUpdateDiagnostics;
