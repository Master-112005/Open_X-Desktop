const EventEmitter = require('events');
const path = require('path');
const STATES = require('./VerificationState');
const EVENTS = require('./VerificationEvents');
const VerificationEngine = require('./VerificationEngine');
const VerificationDiagnostics = require('./VerificationDiagnostics');
const VerificationLogger = require('./VerificationLogger');
const VerificationHistory = require('./VerificationHistory');
const { VerificationConfiguration } = require('./VerificationConfiguration');
const VerificationResult = require('./VerificationResult');

class VerificationManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.configuration = options.configuration instanceof VerificationConfiguration
      ? options.configuration
      : new VerificationConfiguration(options.verification || options.configuration || {});
    this.versionManager = options.versionManager;
    this.directories = options.directories || {};
    this.state = STATES.UNINITIALIZED;
    this.logger = options.verificationLogger || new VerificationLogger({
      logger: options.logger,
      enabled: this.configuration.loggingEnabled
    });
    this.diagnostics = options.diagnostics || new VerificationDiagnostics({
      enabled: this.configuration.diagnosticsEnabled
    });
    this.history = options.history || new VerificationHistory({
      historyPath: this.directories.cacheDir ? path.join(this.directories.cacheDir, 'verification-history.json') : ''
    });
    this.engine = options.engine || new VerificationEngine({
      configuration: this.configuration,
      versionManager: this.versionManager,
      diagnostics: this.diagnostics,
      emitEvent: (event, payload) => this._emit(event, payload)
    });
    this.latestResult = null;
  }

  initialize(directories = this.directories) {
    this.directories = directories || this.directories;
    this.history.historyPath = this.directories.cacheDir ? path.join(this.directories.cacheDir, 'verification-history.json') : this.history.historyPath;
    this.history.ensure();
    this._setState(STATES.READY);
    return VerificationResult.passed({ data: this.getStatus(), securityLevel: 'ready' });
  }

  async verify(input = {}) {
    if (!this.configuration.enabled) {
      const error = new Error('Verification is disabled.');
      error.code = 'VERIFICATION_DISABLED';
      return VerificationResult.failed(error, { securityLevel: 'disabled' });
    }
    try {
      this._setState(STATES.VERIFYING);
      this.diagnostics.started();
      this.logger.info('Verification started', { filePath: input.filePath });
      const result = await this.engine.verify(input);
      this.latestResult = result;
      this.diagnostics.completed(result);
      const record = this._historyRecord(result);
      this.history.add(record);
      this._setState(result.success ? STATES.PASSED : STATES.FAILED);
      this._emit(result.success ? EVENTS.VERIFICATION_COMPLETED : EVENTS.VERIFICATION_FAILED, result);
      return result;
    } catch (error) {
      this.diagnostics.recordError(error);
      this._setState(STATES.ERROR);
      this._emit(EVENTS.ERROR, { error: error.message, code: error.code || null });
      return VerificationResult.failed(error, { securityLevel: 'error' });
    }
  }

  verifyHash(input = {}) {
    return this.verify(input);
  }

  verifySignature(input = {}) {
    return this.verify(input);
  }

  verifyVersion(input = {}) {
    return this.verify(input);
  }

  verifyManifest(input = {}) {
    return this.verify(input);
  }

  verifyPolicy(input = {}) {
    return this.verify(input);
  }

  shutdown() {
    this._setState(STATES.READY);
    return this.getStatus();
  }

  getStatus() {
    return {
      state: this.state,
      configuration: this.configuration.toJSON(),
      latestResult: this.latestResult,
      history: this.history.list().slice(0, 25)
    };
  }

  getDiagnostics() {
    return this.diagnostics.snapshot(this.getStatus());
  }

  _historyRecord(result) {
    return {
      verificationId: result.verificationId,
      installer: result.data?.filePath || '',
      version: result.data?.manifest?.version || result.data?.manifest?.latestVersion || '',
      time: result.timestamp,
      result: result.status,
      failureReason: result.errors?.[0]?.message || '',
      durationMs: result.durationMs,
      securityLevel: result.securityLevel
    };
  }

  _setState(state) {
    const previousState = this.state;
    this.state = state;
    this._emit(EVENTS.STATE_CHANGED, { previousState, state });
  }

  _emit(event, payload) {
    this.emit(event, payload);
  }
}

module.exports = VerificationManager;
