class VersionCheckDiagnostics {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.lastCheckAt = null;
    this.lastSuccessAt = null;
    this.lastFailureAt = null;
    this.lastServerLatencyMs = null;
    this.errors = [];
    this.statistics = {
      checkCount: 0,
      successCount: 0,
      failureCount: 0,
      retryCount: 0,
      invalidResponseCount: 0,
      offlineCount: 0,
      stateChangeCount: 0
    };
  }

  markCheckStarted() {
    this.lastCheckAt = new Date().toISOString();
    this.statistics.checkCount += 1;
  }

  markSuccess(latencyMs = null) {
    this.lastSuccessAt = new Date().toISOString();
    this.statistics.successCount += 1;
    this.lastServerLatencyMs = Number.isFinite(Number(latencyMs)) ? Number(latencyMs) : this.lastServerLatencyMs;
  }

  markFailure(error) {
    this.lastFailureAt = new Date().toISOString();
    this.statistics.failureCount += 1;
    this.recordError(error);
  }

  markRetry() {
    this.statistics.retryCount += 1;
  }

  markInvalidResponse(error) {
    this.statistics.invalidResponseCount += 1;
    this.markFailure(error);
  }

  markOffline(error) {
    this.statistics.offlineCount += 1;
    this.markFailure(error);
  }

  markStateChanged() {
    this.statistics.stateChangeCount += 1;
  }

  recordError(error) {
    this.errors.push({
      at: new Date().toISOString(),
      message: String(error?.message || error || 'Unknown error'),
      code: error?.code || null
    });
    this.errors = this.errors.slice(-25);
  }

  snapshot(context = {}) {
    return Object.freeze({
      enabled: this.enabled,
      state: context.state || 'UNKNOWN',
      currentVersion: context.currentVersion || null,
      latestVersion: context.latestVersion || null,
      lastResult: context.lastResult || null,
      lastCheckAt: this.lastCheckAt,
      lastSuccessAt: this.lastSuccessAt,
      lastFailureAt: this.lastFailureAt,
      lastServerLatencyMs: this.lastServerLatencyMs,
      statistics: { ...this.statistics },
      errors: this.errors.slice()
    });
  }
}

module.exports = VersionCheckDiagnostics;
