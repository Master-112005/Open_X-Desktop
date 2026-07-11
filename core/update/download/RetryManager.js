class RetryManager {
  constructor(options = {}) {
    this.maxRetries = Math.max(0, Number(options.maxRetries || 0));
    this.retryDelayMs = Math.max(100, Number(options.retryDelayMs || 1000));
  }

  canRetry(error, retryCount) {
    if (retryCount >= this.maxRetries) return false;
    const code = String(error?.code || '');
    if (['CANCELLED', 'PAUSED', 'SOURCE_NOT_RELAY', 'INVALID_URL', 'UNSUPPORTED_PROTOCOL', 'UNKNOWN_CONTENT_TYPE'].includes(code)) return false;
    return true;
  }

  getDelay(retryCount) {
    return Math.min(300000, this.retryDelayMs * (2 ** Math.max(0, retryCount)));
  }
}

module.exports = RetryManager;
