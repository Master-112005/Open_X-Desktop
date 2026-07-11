class DownloadStatistics {
  constructor() {
    this.createdAt = new Date().toISOString();
    this.bytesDownloaded = 0;
    this.currentSpeed = 0;
    this.averageSpeed = 0;
    this.peakSpeed = 0;
    this.minimumSpeed = 0;
    this.etaMs = null;
    this.retries = 0;
    this.resumeCount = 0;
    this.diskWriteTimeMs = 0;
    this.networkLatencyMs = 0;
  }

  snapshot() {
    return Object.freeze({ ...this });
  }
}

module.exports = DownloadStatistics;
