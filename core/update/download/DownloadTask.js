const STATES = require('./DownloadState');
const DownloadStatistics = require('./DownloadStatistics');

class DownloadTask {
  constructor(input = {}) {
    const timestamp = new Date().toISOString();
    this.id = input.id || `download_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    this.url = String(input.url || input.assetUrl || '').trim();
    this.fileName = String(input.fileName || '').trim();
    this.assetType = String(input.assetType || 'installer').trim();
    this.source = String(input.source || '').trim();
    this.relayProvided = input.relayProvided === true || this.source === 'relay';
    this.state = input.state || STATES.IDLE;
    this.createdAt = input.createdAt || timestamp;
    this.startedAt = input.startedAt || null;
    this.completedAt = input.completedAt || null;
    this.updatedAt = timestamp;
    this.currentBytes = Number(input.currentBytes || 0);
    this.totalBytes = Number(input.totalBytes || 0);
    this.destinationPath = input.destinationPath || '';
    this.partPath = input.partPath || '';
    this.metadataPath = input.metadataPath || '';
    this.retryCount = Number(input.retryCount || 0);
    this.resumeCount = Number(input.resumeCount || 0);
    this.failureReason = input.failureReason || '';
    this.futureChecksum = input.futureChecksum || null;
    this.statistics = input.statistics || new DownloadStatistics();
    this.controller = null;
  }

  setState(state) {
    this.state = state;
    this.updatedAt = new Date().toISOString();
  }

  snapshot() {
    const percent = this.totalBytes > 0 ? Math.min(100, Math.round((this.currentBytes / this.totalBytes) * 10000) / 100) : 0;
    const elapsedTimeMs = this.startedAt ? Math.max(0, Date.now() - Date.parse(this.startedAt)) : 0;
    return Object.freeze({
      id: this.id,
      url: this.url,
      fileName: this.fileName,
      assetType: this.assetType,
      source: this.source,
      state: this.state,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      updatedAt: this.updatedAt,
      currentBytes: this.currentBytes,
      totalBytes: this.totalBytes,
      percent,
      elapsedTimeMs,
      destinationPath: this.destinationPath,
      partPath: this.partPath,
      metadataPath: this.metadataPath,
      retryCount: this.retryCount,
      resumeCount: this.resumeCount,
      failureReason: this.failureReason,
      futureChecksum: this.futureChecksum,
      statistics: this.statistics.snapshot?.() || this.statistics
    });
  }
}

module.exports = DownloadTask;
