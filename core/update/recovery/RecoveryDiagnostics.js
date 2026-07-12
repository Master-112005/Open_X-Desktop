class RecoveryDiagnostics {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.recoveryCount = 0;
    this.rollbackCount = 0;
    this.successfulRecoveries = 0;
    this.failedRecoveries = 0;
    this.startupFailures = 0;
    this.healthFailures = 0;
    this.rollbackTimes = [];
    this.recoveryTimes = [];
    this.lastRecoveryVersion = '';
    this.lastFailureReason = '';
    this.errors = [];
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

  recordError(error) {
    if (!this.enabled) return;
    this.errors.unshift({
      message: String(error?.message || error),
      code: error?.code || null,
      at: new Date().toISOString()
    });
    this.errors = this.errors.slice(0, 25);
  }

  average(values = []) {
    if (!values.length) return 0;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }

  snapshot(status = {}) {
    return Object.freeze({
      enabled: this.enabled,
      counters: {
        recoveryCount: this.recoveryCount,
        rollbackCount: this.rollbackCount,
        successfulRecoveries: this.successfulRecoveries,
        failedRecoveries: this.failedRecoveries,
        startupFailures: this.startupFailures,
        healthFailures: this.healthFailures
      },
      timings: {
        rollbackTimes: this.rollbackTimes.slice(),
        recoveryTimes: this.recoveryTimes.slice(),
        averageRollbackTime: this.average(this.rollbackTimes),
        averageRecoveryTime: this.average(this.recoveryTimes)
      },
      lastRecoveryVersion: this.lastRecoveryVersion,
      lastFailureReason: this.lastFailureReason,
      errors: this.errors.slice(),
      status
    });
  }
}

module.exports = RecoveryDiagnostics;
