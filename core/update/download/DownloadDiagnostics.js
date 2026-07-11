class DownloadDiagnostics {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.reset();
  }

  reset() {
    this.downloadCount = 0;
    this.bytesDownloaded = 0;
    this.averageSpeed = 0;
    this.currentSpeed = 0;
    this.etaMs = null;
    this.retries = 0;
    this.failures = 0;
    this.resumeCount = 0;
    this.cancelledCount = 0;
    this.elapsedTimeMs = 0;
    this.diskWriteTimeMs = 0;
    this.networkLatencyMs = 0;
    this.lastEventAt = null;
    this.errors = [];
  }

  mark(field, count = 1) {
    if (!this.enabled || typeof this[field] !== 'number') return;
    this[field] += Math.max(1, Number(count) || 1);
    this.lastEventAt = new Date().toISOString();
  }

  updateProgress(snapshot = {}) {
    if (!this.enabled) return;
    this.bytesDownloaded = Math.max(this.bytesDownloaded, Number(snapshot.currentBytes || 0));
    this.currentSpeed = Number(snapshot.currentSpeed || 0);
    this.averageSpeed = Number(snapshot.averageSpeed || 0);
    this.etaMs = snapshot.etaMs ?? null;
    this.elapsedTimeMs = Number(snapshot.elapsedTimeMs || 0);
    this.diskWriteTimeMs += Number(snapshot.diskWriteTimeMs || 0);
    this.networkLatencyMs = Number(snapshot.networkLatencyMs || this.networkLatencyMs || 0);
    this.lastEventAt = new Date().toISOString();
  }

  recordError(error) {
    if (!this.enabled) return;
    this.failures += 1;
    this.errors.unshift({
      at: new Date().toISOString(),
      message: error?.message || String(error || 'Unknown error'),
      code: error?.code || null
    });
    this.errors = this.errors.slice(0, 25);
  }

  snapshot(extra = {}) {
    return Object.freeze({
      enabled: this.enabled,
      downloadCount: this.downloadCount,
      bytesDownloaded: this.bytesDownloaded,
      averageSpeed: this.averageSpeed,
      currentSpeed: this.currentSpeed,
      etaMs: this.etaMs,
      retries: this.retries,
      failures: this.failures,
      resumeCount: this.resumeCount,
      cancelledCount: this.cancelledCount,
      elapsedTimeMs: this.elapsedTimeMs,
      diskWriteTimeMs: this.diskWriteTimeMs,
      networkLatencyMs: this.networkLatencyMs,
      lastEventAt: this.lastEventAt,
      errors: this.errors.slice(),
      ...extra
    });
  }
}

module.exports = DownloadDiagnostics;
