const DEFAULT_DOWNLOAD_CONFIGURATION = Object.freeze({
  enabled: true,
  backgroundDownloadsEnabled: true,
  maxRetries: 3,
  retryDelayMs: 1000,
  timeoutMs: 30000,
  maxSimultaneousDownloads: 1,
  bandwidthLimitBytesPerSecond: 0,
  autoResume: true,
  maxBytes: 1024 * 1024 * 1024,
  allowedProtocols: ['http:', 'https:'],
  loggingEnabled: true,
  diagnosticsEnabled: true
});

function clampInteger(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

class DownloadConfiguration {
  constructor(input = {}) {
    const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    this.enabled = source.enabled !== false;
    this.backgroundDownloadsEnabled = source.backgroundDownloadsEnabled !== false;
    this.maxRetries = clampInteger(source.maxRetries, 0, 10, DEFAULT_DOWNLOAD_CONFIGURATION.maxRetries);
    this.retryDelayMs = clampInteger(source.retryDelayMs, 100, 300000, DEFAULT_DOWNLOAD_CONFIGURATION.retryDelayMs);
    this.timeoutMs = clampInteger(source.timeoutMs, 1000, 300000, DEFAULT_DOWNLOAD_CONFIGURATION.timeoutMs);
    this.maxSimultaneousDownloads = clampInteger(source.maxSimultaneousDownloads, 1, 8, DEFAULT_DOWNLOAD_CONFIGURATION.maxSimultaneousDownloads);
    this.bandwidthLimitBytesPerSecond = clampInteger(source.bandwidthLimitBytesPerSecond, 0, 1024 * 1024 * 1024, 0);
    this.autoResume = source.autoResume !== false;
    this.maxBytes = clampInteger(source.maxBytes, 1024, 10 * 1024 * 1024 * 1024, DEFAULT_DOWNLOAD_CONFIGURATION.maxBytes);
    this.allowedProtocols = DEFAULT_DOWNLOAD_CONFIGURATION.allowedProtocols.slice();
    this.loggingEnabled = source.loggingEnabled !== false;
    this.diagnosticsEnabled = source.diagnosticsEnabled !== false;
    Object.freeze(this);
  }

  toJSON() {
    return {
      enabled: this.enabled,
      backgroundDownloadsEnabled: this.backgroundDownloadsEnabled,
      maxRetries: this.maxRetries,
      retryDelayMs: this.retryDelayMs,
      timeoutMs: this.timeoutMs,
      maxSimultaneousDownloads: this.maxSimultaneousDownloads,
      bandwidthLimitBytesPerSecond: this.bandwidthLimitBytesPerSecond,
      autoResume: this.autoResume,
      maxBytes: this.maxBytes,
      allowedProtocols: this.allowedProtocols.slice(),
      loggingEnabled: this.loggingEnabled,
      diagnosticsEnabled: this.diagnosticsEnabled
    };
  }
}

module.exports = {
  DEFAULT_DOWNLOAD_CONFIGURATION,
  DownloadConfiguration
};
