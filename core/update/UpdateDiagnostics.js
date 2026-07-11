const { deepFreeze, normalizeError } = require('./UpdateResult');

class UpdateDiagnostics {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.startedAt = null;
    this.initializedAt = null;
    this.stoppedAt = null;
    this.errors = [];
    this.warnings = [];
    this.statistics = {
      initializeCount: 0,
      startCount: 0,
      stopCount: 0,
      versionReadCount: 0,
      stateChangeCount: 0
    };
  }

  markInitialized() {
    this.initializedAt = new Date().toISOString();
    this.statistics.initializeCount += 1;
  }

  markStarted() {
    this.startedAt = new Date().toISOString();
    this.statistics.startCount += 1;
  }

  markStopped() {
    this.stoppedAt = new Date().toISOString();
    this.statistics.stopCount += 1;
  }

  markVersionRead() {
    this.statistics.versionReadCount += 1;
  }

  markStateChanged() {
    this.statistics.stateChangeCount += 1;
  }

  recordError(error) {
    this.errors.push({ at: new Date().toISOString(), ...normalizeError(error) });
    this.errors = this.errors.slice(-25);
  }

  recordWarning(message, data = {}) {
    this.warnings.push({ at: new Date().toISOString(), message: String(message), data });
    this.warnings = this.warnings.slice(-25);
  }

  snapshot({ state, configuration, version, directories, running, initialized } = {}) {
    return deepFreeze({
      enabled: this.enabled,
      initialized,
      running,
      state,
      initializedAt: this.initializedAt,
      startedAt: this.startedAt,
      stoppedAt: this.stoppedAt,
      configuration,
      version,
      directories,
      health: {
        ok: state !== 'ERROR',
        errors: this.errors.length,
        warnings: this.warnings.length
      },
      statistics: { ...this.statistics },
      errors: this.errors.slice(),
      warnings: this.warnings.slice()
    });
  }
}

module.exports = UpdateDiagnostics;
