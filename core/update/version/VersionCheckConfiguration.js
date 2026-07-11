const DEFAULT_VERSION_CHECK_CONFIGURATION = Object.freeze({
  enabled: true,
  checkOnStartup: true,
  startupDelayMs: 5000,
  requestTimeoutMs: 10000,
  retryCount: 1,
  retryDelayMs: 1000,
  channel: 'stable',
  loggingEnabled: true,
  diagnosticsEnabled: true
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clampInteger(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function normalizeChannel(value, fallback = 'stable') {
  const channel = String(value || fallback).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  return channel || fallback;
}

class VersionCheckConfiguration {
  constructor(input = {}) {
    const source = isPlainObject(input) ? input : {};
    this.enabled = source.enabled !== false;
    this.checkOnStartup = source.checkOnStartup !== false;
    this.startupDelayMs = clampInteger(source.startupDelayMs ?? source.startupDelay, 0, 300000, DEFAULT_VERSION_CHECK_CONFIGURATION.startupDelayMs);
    this.requestTimeoutMs = clampInteger(source.requestTimeoutMs ?? source.timeoutMs ?? source.timeout, 1000, 60000, DEFAULT_VERSION_CHECK_CONFIGURATION.requestTimeoutMs);
    this.retryCount = clampInteger(source.retryCount, 0, 5, DEFAULT_VERSION_CHECK_CONFIGURATION.retryCount);
    this.retryDelayMs = clampInteger(source.retryDelayMs ?? source.retryDelay, 100, 60000, DEFAULT_VERSION_CHECK_CONFIGURATION.retryDelayMs);
    this.channel = normalizeChannel(source.channel, DEFAULT_VERSION_CHECK_CONFIGURATION.channel);
    this.loggingEnabled = source.loggingEnabled !== false;
    this.diagnosticsEnabled = source.diagnosticsEnabled !== false;
    Object.freeze(this);
  }

  toJSON() {
    return {
      enabled: this.enabled,
      checkOnStartup: this.checkOnStartup,
      startupDelayMs: this.startupDelayMs,
      requestTimeoutMs: this.requestTimeoutMs,
      retryCount: this.retryCount,
      retryDelayMs: this.retryDelayMs,
      channel: this.channel,
      loggingEnabled: this.loggingEnabled,
      diagnosticsEnabled: this.diagnosticsEnabled
    };
  }

  merge(input = {}) {
    return new VersionCheckConfiguration({
      ...this.toJSON(),
      ...(isPlainObject(input) ? input : {})
    });
  }
}

module.exports = {
  DEFAULT_VERSION_CHECK_CONFIGURATION,
  VersionCheckConfiguration
};
