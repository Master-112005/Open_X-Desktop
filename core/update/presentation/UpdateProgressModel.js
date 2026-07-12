function fmtBytes(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

class UpdateProgressModel {
  constructor(download = {}) {
    this.state = download.state || 'IDLE';
    this.currentBytes = Number(download.currentBytes || 0);
    this.totalBytes = Number(download.totalBytes || 0);
    this.percent = Number(download.percent || 0);
    this.downloadedSize = fmtBytes(this.currentBytes);
    this.totalSize = this.totalBytes ? fmtBytes(this.totalBytes) : 'Unknown';
    this.currentSpeed = Number(download.statistics?.currentSpeed || download.currentSpeed || 0);
    this.averageSpeed = Number(download.statistics?.averageSpeed || download.averageSpeed || 0);
    this.currentSpeedLabel = `${fmtBytes(this.currentSpeed)}/s`;
    this.averageSpeedLabel = `${fmtBytes(this.averageSpeed)}/s`;
    this.speedLabel = this.currentSpeed > 0 ? this.currentSpeedLabel : this.averageSpeedLabel;
    this.transferredLabel = `${this.downloadedSize} / ${this.totalSize}`;
    this.etaMs = download.statistics?.etaMs ?? download.etaMs ?? null;
    this.etaLabel = this.etaMs ? `${Math.ceil(this.etaMs / 1000)}s` : 'Unknown';
    this.remainingTimeLabel = this.etaLabel;
    this.retryCount = Number(download.retryCount || 0);
    this.resumeCount = Number(download.resumeCount || 0);
    Object.freeze(this);
  }
}

module.exports = UpdateProgressModel;
