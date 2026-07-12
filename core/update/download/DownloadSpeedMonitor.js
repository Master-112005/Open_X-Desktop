class DownloadSpeedMonitor {
  constructor(options = {}) {
    this.windowSize = Math.max(2, Number(options.windowSize || 8));
    this.samples = [];
    this.startedAt = Date.now();
    this.lastAt = this.startedAt;
    this.lastBytes = 0;
    this.peakSpeed = 0;
    this.minimumSpeed = 0;
  }

  sample(totalBytes, now = Date.now()) {
    const elapsedMs = Math.max(1, now - this.lastAt);
    const delta = Math.max(0, Number(totalBytes || 0) - this.lastBytes);
    const speed = Math.round(delta / (elapsedMs / 1000));
    this.samples.push(speed);
    this.samples = this.samples.slice(-this.windowSize);
    this.lastAt = now;
    this.lastBytes = Number(totalBytes || 0);
    this.peakSpeed = Math.max(this.peakSpeed, speed);
    this.minimumSpeed = this.minimumSpeed === 0 ? speed : Math.min(this.minimumSpeed, speed);
    const rolling = Math.round(this.samples.reduce((sum, item) => sum + item, 0) / Math.max(1, this.samples.length));
    const average = Math.round(Number(totalBytes || 0) / (Math.max(1, now - this.startedAt) / 1000));
    return { currentSpeed: speed, rollingAverage: rolling, averageSpeed: average, peakSpeed: this.peakSpeed, minimumSpeed: this.minimumSpeed };
  }
}

module.exports = DownloadSpeedMonitor;
