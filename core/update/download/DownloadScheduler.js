class DownloadScheduler {
  constructor(options = {}) {
    this.maxActive = Math.max(1, Number(options.maxActive || 1));
  }

  canStart(activeCount) {
    return activeCount < this.maxActive;
  }
}

module.exports = DownloadScheduler;
