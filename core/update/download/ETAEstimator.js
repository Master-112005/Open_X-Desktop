class ETAEstimator {
  constructor(options = {}) {
    this.alpha = Number(options.alpha || 0.25);
    this.smoothedEtaMs = null;
  }

  estimate(currentBytes, totalBytes, speedBytesPerSecond) {
    const remaining = Math.max(0, Number(totalBytes || 0) - Number(currentBytes || 0));
    const speed = Math.max(0, Number(speedBytesPerSecond || 0));
    if (!remaining || !speed) return null;
    const raw = Math.round((remaining / speed) * 1000);
    this.smoothedEtaMs = this.smoothedEtaMs === null
      ? raw
      : Math.round((this.alpha * raw) + ((1 - this.alpha) * this.smoothedEtaMs));
    return this.smoothedEtaMs;
  }
}

module.exports = ETAEstimator;
