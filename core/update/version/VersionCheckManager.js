const EventEmitter = require('events');
const VersionManager = require('../VersionManager');
const VersionCheckRequest = require('./VersionCheckRequest');
const { VersionCheckResponse } = require('./VersionCheckResponse');
const VersionCheckResult = require('./VersionCheckResult');
const VersionCheckDiagnostics = require('./VersionCheckDiagnostics');
const { VersionCheckConfiguration } = require('./VersionCheckConfiguration');
const VERSION_CHECK_EVENTS = require('./VersionCheckEvents');
const { VERSION_CHECK_STATES } = require('./VersionCheckState');
const { VersionComparisonResult } = require('./VersionComparisonResult');

function delay(ms) {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

class VersionCheckManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.configuration = options.configuration instanceof VersionCheckConfiguration
      ? options.configuration
      : new VersionCheckConfiguration(options.versionCheck || options.update?.versionCheck || {});
    this.versionManager = options.versionManager || new VersionManager({
      packagePath: options.packagePath,
      metadata: options.metadata,
      logger: options.logger
    });
    this.relayClient = options.relayClient || null;
    this.relayClientProvider = options.relayClientProvider || null;
    this.logger = options.logger || console;
    this.diagnostics = options.diagnostics || new VersionCheckDiagnostics({
      enabled: this.configuration.diagnosticsEnabled
    });
    this.state = VERSION_CHECK_STATES.UNKNOWN;
    this.currentVersion = null;
    this.latestVersion = null;
    this.latestResult = null;
    this.startupTimer = null;
  }

  initialize() {
    const version = this.getCurrentVersion();
    if (version.success) this.currentVersion = version.data.version;
    return VersionCheckResult.ok('update.versionCheck.initialized', this.getStatus());
  }

  setRelayClient(clientOrProvider) {
    if (typeof clientOrProvider === 'function') this.relayClientProvider = clientOrProvider;
    else this.relayClient = clientOrProvider || null;
    return this.getStatus();
  }

  async checkNow(options = {}) {
    if (this.configuration.enabled !== true) {
      const error = new Error('Version checking is disabled.');
      error.code = 'VERSION_CHECK_DISABLED';
      return this._fail(error, VERSION_CHECK_STATES.ERROR);
    }

    const startedAt = Date.now();
    this._setState(VERSION_CHECK_STATES.CHECKING);
    this.diagnostics.markCheckStarted();
    this.emit(VERSION_CHECK_EVENTS.VERSION_CHECK_STARTED, this.getStatus());

    const version = this.getCurrentVersion();
    if (!version.success) return this._fail(new Error(version.error?.message || 'Unable to read current version.'), VERSION_CHECK_STATES.ERROR);
    this.currentVersion = version.data.version;

    const request = new VersionCheckRequest({
      currentVersion: this.currentVersion,
      channel: options.channel || this.configuration.channel,
      build: options.build || this.currentVersion.replace(/\D/g, ''),
      applicationId: 'openx',
      capabilities: {
        versionOnly: true,
        download: false,
        install: false,
        notifications: false
      }
    });

    const attempts = Math.max(1, Number(options.retryCount ?? this.configuration.retryCount) + 1);
    let lastError = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        if (attempt > 1) this.diagnostics.markRetry();
        const response = await this._sendRequest(request, options);
        const parsed = this._validateResponse(response);
        if (['ERROR', 'MANIFEST_UNAVAILABLE', 'INVALID_VERSION'].includes(parsed.status)) {
          const error = new Error(parsed.message || parsed.errorCode || 'Version check failed.');
          error.code = parsed.errorCode || parsed.status;
          throw error;
        }
        const comparison = this._compare(parsed);
        this.latestVersion = parsed.latestVersion;
        this.latestResult = {
          request: request.toJSON(),
          response: parsed.toJSON(),
          comparison,
          checkedAt: parsed.checkedAt,
          durationMs: Math.max(0, Date.now() - startedAt)
        };
        this.diagnostics.markSuccess(parsed.responseTimeMs);
        if (parsed.status === 'UPDATE_AVAILABLE' || parsed.status === 'UNSUPPORTED_VERSION') {
          this._setState(VERSION_CHECK_STATES.UPDATE_AVAILABLE);
          this.emit(VERSION_CHECK_EVENTS.UPDATE_AVAILABLE, this.latestResult);
        } else {
          this._setState(VERSION_CHECK_STATES.UP_TO_DATE);
          this.emit(VERSION_CHECK_EVENTS.ALREADY_UP_TO_DATE, this.latestResult);
        }
        this.emit(VERSION_CHECK_EVENTS.VERSION_CHECK_COMPLETED, this.latestResult);
        return VersionCheckResult.ok('update.versionCheck.completed', this.latestResult);
      } catch (error) {
        lastError = error;
        if (attempt < attempts) await delay(this.configuration.retryDelayMs);
      }
    }

    const offline = lastError?.code === 'RELAY_UNAVAILABLE' || /not connected|closed|timeout|unavailable/i.test(String(lastError?.message || ''));
    return this._fail(lastError || new Error('Version check failed.'), offline ? VERSION_CHECK_STATES.OFFLINE : VERSION_CHECK_STATES.ERROR);
  }

  checkOnStartup(options = {}) {
    if (!this.configuration.enabled || !this.configuration.checkOnStartup) {
      return VersionCheckResult.ok('update.versionCheck.startup.skipped', {
        skipped: true,
        reason: this.configuration.enabled ? 'startup-disabled' : 'disabled'
      });
    }
    this.clearStartupTimer();
    const delayMs = Math.max(0, Number(options.startupDelayMs ?? this.configuration.startupDelayMs) || 0);
    this.startupTimer = setTimeout(() => {
      this.startupTimer = null;
      this.checkNow({ reason: 'startup' }).catch(error => {
        this.logger.warn?.('Startup version check failed', { error: error.message });
      });
    }, delayMs);
    this.startupTimer.unref?.();
    return VersionCheckResult.ok('update.versionCheck.startup.scheduled', { scheduled: true, delayMs });
  }

  shutdown() {
    this.clearStartupTimer();
    return VersionCheckResult.ok('update.versionCheck.shutdown', this.getStatus());
  }

  getLatestResult() {
    return VersionCheckResult.ok('update.versionCheck.latest', {
      latestResult: this.latestResult,
      status: this.getStatus()
    });
  }

  isUpdateAvailable() {
    return this.state === VERSION_CHECK_STATES.UPDATE_AVAILABLE;
  }

  getCurrentVersion() {
    return this.versionManager.getCurrentVersion();
  }

  getLatestVersion() {
    return this.latestVersion;
  }

  getStatus() {
    return {
      state: this.state,
      enabled: this.configuration.enabled,
      currentVersion: this.currentVersion,
      latestVersion: this.latestVersion,
      updateAvailable: this.isUpdateAvailable(),
      lastResult: this.latestResult,
      configuration: this.configuration.toJSON()
    };
  }

  getDiagnostics() {
    return this.diagnostics.snapshot(this.getStatus());
  }

  clearStartupTimer() {
    if (this.startupTimer) clearTimeout(this.startupTimer);
    this.startupTimer = null;
  }

  async _sendRequest(request, options = {}) {
    const client = this.relayClientProvider ? this.relayClientProvider() : this.relayClient;
    if (!client || typeof client.requestVersionCheck !== 'function') {
      const error = new Error('Relay client does not support version checking.');
      error.code = 'RELAY_UNAVAILABLE';
      throw error;
    }
    if (typeof client.isConnected === 'function' && !client.isConnected()) {
      const error = new Error('Cloud relay is not connected.');
      error.code = 'RELAY_UNAVAILABLE';
      throw error;
    }
    return client.requestVersionCheck(request.toJSON(), {
      timeoutMs: options.timeoutMs ?? this.configuration.requestTimeoutMs
    });
  }

  _validateResponse(response) {
    try {
      return new VersionCheckResponse(response);
    } catch (error) {
      error.code = 'INVALID_VERSION_RESPONSE';
      this.diagnostics.markInvalidResponse(error);
      this._setState(VERSION_CHECK_STATES.INVALID_RESPONSE);
      this.emit(VERSION_CHECK_EVENTS.INVALID_RESPONSE, { error: error.message, response: null });
      throw error;
    }
  }

  _compare(response) {
    const currentVersion = response.currentVersion || this.currentVersion;
    const latestVersion = response.latestVersion || currentVersion;
    const comparison = this.versionManager.compareVersions(latestVersion, currentVersion);
    return new VersionComparisonResult({
      status: response.status,
      currentVersion,
      latestVersion,
      minimumVersion: response.minimumVersion,
      comparison,
      checkedAt: response.checkedAt
    });
  }

  _fail(error, state) {
    const normalizedState = state || VERSION_CHECK_STATES.ERROR;
    if (normalizedState === VERSION_CHECK_STATES.OFFLINE) {
      this.diagnostics.markOffline(error);
      this.emit(VERSION_CHECK_EVENTS.SERVER_UNAVAILABLE, { error: error.message, code: error.code || null });
    } else {
      this.diagnostics.markFailure(error);
    }
    this._setState(normalizedState);
    this.emit(VERSION_CHECK_EVENTS.VERSION_CHECK_FAILED, { error: error.message, code: error.code || null, status: this.getStatus() });
    return VersionCheckResult.fail('update.versionCheck.failed', error, {
      status: this.getStatus()
    });
  }

  _setState(state) {
    if (this.state === state) return;
    const previousState = this.state;
    this.state = state;
    this.diagnostics.markStateChanged();
    this.logger.info?.('Version check state changed', { previousState, state });
    this.emit(VERSION_CHECK_EVENTS.STATE_CHANGED, { previousState, state });
  }
}

module.exports = VersionCheckManager;
