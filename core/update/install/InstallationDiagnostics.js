class InstallationDiagnostics {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.installAttempts = 0;
    this.successfulInstalls = 0;
    this.cancelledInstalls = 0;
    this.failedInstalls = 0;
    this.preparationTimes = [];
    this.shutdownTimes = [];
    this.launchTimes = [];
    this.exitCodes = [];
    this.errors = [];
  }

  mark(field) {
    if (!this.enabled && field !== 'installAttempts') return;
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
        installAttempts: this.installAttempts,
        successfulInstalls: this.successfulInstalls,
        cancelledInstalls: this.cancelledInstalls,
        failedInstalls: this.failedInstalls
      },
      timings: {
        preparationTimes: this.preparationTimes.slice(),
        shutdownTimes: this.shutdownTimes.slice(),
        launchTimes: this.launchTimes.slice()
      },
      exitCodes: this.exitCodes.slice(),
      errors: this.errors.slice(),
      status
    });
  }
}

module.exports = InstallationDiagnostics;
