const EventEmitter = require('events');
const path = require('path');
const { RecoveryConfiguration } = require('./RecoveryConfiguration');
const { RECOVERY_STATES } = require('./RecoveryState');
const EVENTS = require('./RecoveryEvents');
const RecoveryResult = require('./RecoveryResult');
const RecoveryLogger = require('./RecoveryLogger');
const RecoveryDiagnostics = require('./RecoveryDiagnostics');
const RecoveryContext = require('./RecoveryContext');
const RecoverySession = require('./RecoverySession');
const RecoveryPolicy = require('./RecoveryPolicy');
const RecoveryStorage = require('./RecoveryStorage');
const BackupManager = require('./BackupManager');
const RollbackManager = require('./RollbackManager');
const PreviousVersionLocator = require('./PreviousVersionLocator');
const StartupValidator = require('./StartupValidator');
const HealthValidator = require('./HealthValidator');
const RecoveryCoordinator = require('./RecoveryCoordinator');

function makeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

class RecoveryService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.configuration = options.configuration instanceof RecoveryConfiguration
      ? options.configuration
      : new RecoveryConfiguration(options.recovery || options.configuration || {});
    this.directories = options.directories || {};
    this.versionManager = options.versionManager || null;
    this.currentVersionProvider = options.currentVersionProvider || (() => this.versionManager?.getCurrentVersion?.()?.data?.version || '');
    this.backupPathsProvider = options.backupPathsProvider || (() => options.backupPaths || []);
    this.logger = options.recoveryLogger || new RecoveryLogger({
      logger: options.logger,
      enabled: this.configuration.loggingEnabled
    });
    this.diagnostics = options.diagnostics || new RecoveryDiagnostics({
      enabled: this.configuration.diagnosticsEnabled
    });
    this.context = new RecoveryContext();
    this.policy = options.policy || new RecoveryPolicy(this.configuration);
    this.storage = options.storage || new RecoveryStorage({
      rootDir: this._recoveryRoot(this.directories),
      historyLimit: this.configuration.historyLimit
    });
    this.backupManager = options.backupManager || new BackupManager({
      backupRoot: this._backupRoot(this.directories),
      configuration: this.configuration,
      logger: this.logger
    });
    this.rollbackManager = options.rollbackManager || new RollbackManager({ logger: this.logger });
    this.previousVersionLocator = options.previousVersionLocator || new PreviousVersionLocator({
      backupManager: this.backupManager
    });
    this.startupValidator = options.startupValidator || new StartupValidator({ configuration: this.configuration });
    this.healthValidator = options.healthValidator || new HealthValidator({ configuration: this.configuration });
    this.coordinator = options.coordinator || new RecoveryCoordinator({
      restoreHandlers: options.restoreHandlers || [],
      restartManager: options.restartManager,
      restartOptions: options.restartOptions || {}
    });
    this.state = RECOVERY_STATES.IDLE;
    this.currentSession = null;
  }

  initialize(directories = this.directories) {
    this.directories = directories || this.directories;
    this.storage.rootDir = this._recoveryRoot(this.directories);
    this.storage.statePath = path.join(this.storage.rootDir, 'state.json');
    this.storage.history.historyPath = path.join(this.storage.rootDir, 'history.json');
    this.storage.rollbackHistory.historyPath = path.join(this.storage.rootDir, 'rollback-history.json');
    this.storage.history.limit = this.configuration.historyLimit;
    this.storage.rollbackHistory.limit = this.configuration.historyLimit;
    this.storage.ensure();
    this.backupManager.configuration = this.configuration;
    this.backupManager.initialize({ backupRoot: this._backupRoot(this.directories) });
    this.startupValidator.configuration = this.configuration;
    this.healthValidator.configuration = this.configuration;
    this.context = this.context.update({ initialized: true, directories: this.directories, latestBackup: this.backupManager.getLatestBackup() });
    this._setState(RECOVERY_STATES.IDLE);
    return RecoveryResult.ok('recovery.initialized', this.getStatus());
  }

  updateConfiguration(configuration) {
    this.configuration = configuration instanceof RecoveryConfiguration
      ? configuration
      : new RecoveryConfiguration(configuration || {});
    this.policy.configuration = this.configuration;
    this.backupManager.configuration = this.configuration;
    this.startupValidator.configuration = this.configuration;
    this.healthValidator.configuration = this.configuration;
    this.storage.history.limit = this.configuration.historyLimit;
    this.storage.rollbackHistory.limit = this.configuration.historyLimit;
  }

  createBackupForUpdate(input = {}) {
    if (!this.configuration.enabled) return RecoveryResult.ok('recovery.backup.skipped', { skipped: true, reason: 'disabled' });
    const currentVersion = input.currentVersion || this.currentVersionProvider();
    const targetVersion = input.targetVersion || input.installerVersion || '';
    const session = new RecoverySession({ currentVersion, previousVersion: currentVersion, targetVersion });
    this.currentSession = session;
    this._setState(RECOVERY_STATES.BACKUP_CREATED);
    try {
      const sourcePaths = input.sourcePaths || this.backupPathsProvider(input) || [];
      const backup = this.backupManager.createBackup({
        sessionId: session.sessionId,
        currentVersion,
        targetVersion,
        sourcePaths,
        source: input.source || 'self-update'
      });
      session.setBackup(backup);
      this.storage.savePendingSession(session);
      this.context = this.context.update({ currentSession: session, latestBackup: backup });
      this._emit(EVENTS.BACKUP_CREATED, { session: session.snapshot(), backup });
      return RecoveryResult.ok('recovery.backup.created', { session: session.snapshot(), backup });
    } catch (error) {
      session.recordError(error);
      return this._fail('recovery.backup.failed', error);
    }
  }

  markInstalling(input = {}) {
    this._ensureSession(input);
    this._setState(RECOVERY_STATES.INSTALLING);
    this.storage.savePendingSession(this.currentSession);
    return RecoveryResult.ok('recovery.installing', this.getStatus());
  }

  markStartupValidationPending(input = {}) {
    if (!this.configuration.enabled || this.configuration.startupValidationEnabled === false) {
      return RecoveryResult.ok('recovery.startupValidation.skipped', { skipped: true });
    }
    const session = this._ensureSession(input);
    session.setState(RECOVERY_STATES.STARTUP_VALIDATION);
    session.targetVersion = input.targetVersion || session.targetVersion;
    this._setState(RECOVERY_STATES.STARTUP_VALIDATION);
    this.storage.savePendingSession(session);
    return RecoveryResult.ok('recovery.startupValidation.pending', { session: session.snapshot() });
  }

  async validateStartup(input = {}) {
    const pending = this._loadPendingSession();
    if (!pending || pending.state !== RECOVERY_STATES.STARTUP_VALIDATION) {
      return RecoveryResult.ok('recovery.startupValidation.none', { skipped: true });
    }
    this.currentSession = pending;
    const startupResult = this.startupValidator.validate(input);
    const healthResult = this.healthValidator.validate(input);
    pending.startupResult = startupResult;
    pending.healthResult = healthResult;
    if (startupResult.success && healthResult.success) {
      pending.setState(RECOVERY_STATES.RECOVERY_COMPLETED);
      this.storage.addHistory({ ...pending.snapshot(), outcome: 'startup-validated' });
      this.storage.clearPendingSession();
      this._setState(RECOVERY_STATES.RECOVERY_COMPLETED);
      this._emit(EVENTS.RECOVERY_COMPLETED, { session: pending.snapshot(), startup: startupResult, health: healthResult });
      return RecoveryResult.ok('recovery.startupValidation.completed', { session: pending.snapshot(), startup: startupResult, health: healthResult });
    }
    const error = makeError('STARTUP_VALIDATION_FAILED', startupResult.errors.concat(healthResult.errors).join(' ') || 'Startup validation failed.');
    this.diagnostics.mark(startupResult.success ? 'healthFailures' : 'startupFailures');
    this._emit(EVENTS.STARTUP_VALIDATION_FAILED, { session: pending.snapshot(), startup: startupResult, health: healthResult });
    return this.recover(error, { startupResult, healthResult, reason: 'startup-validation' });
  }

  async handleInstallationFailure(error, context = {}) {
    this._emit(EVENTS.INSTALLATION_FAILED, { error: error?.message || String(error), context });
    return this.recover(error, { ...context, reason: 'installation-failure' });
  }

  async handleStartupFailure(error, context = {}) {
    this._emit(EVENTS.STARTUP_VALIDATION_FAILED, { error: error?.message || String(error), context });
    return this.recover(error, { ...context, reason: 'startup-failure' });
  }

  async recover(error, context = {}) {
    const startedAt = Date.now();
    const backup = context.backup || this.previousVersionLocator.locate().backup;
    const attempts = this.storage.listRollbacks().filter(item => item.success !== true).length;
    const policy = this.policy.evaluate({ running: this.context.running, backup, attempts });
    if (!policy.allowed) {
      return this._fail('recovery.policy', makeError(policy.code, policy.message));
    }

    const session = this._ensureSession({
      currentVersion: backup.currentVersion,
      targetVersion: backup.targetVersion,
      failureReason: error?.message || String(error || context.reason || 'recovery-required')
    });
    session.startRecovery(error?.message || context.reason || 'recovery-required');
    session.setState(RECOVERY_STATES.RECOVERY_REQUIRED);
    this.context = this.context.update({ running: true, currentSession: session });
    this._setState(RECOVERY_STATES.RECOVERY_REQUIRED);
    this._emit(EVENTS.RECOVERY_STARTED, { session: session.snapshot(), reason: session.failureReason });

    try {
      this._setState(RECOVERY_STATES.ROLLBACK_PREPARING);
      this._setState(RECOVERY_STATES.ROLLBACK_RUNNING);
      this._emit(EVENTS.ROLLBACK_STARTED, { session: session.snapshot(), backupId: backup.backupId });
      const rollback = this.rollbackManager.rollback({ backup, restoreRoot: context.restoreRoot });
      session.rollbackDurationMs = rollback.durationMs;
      this.diagnostics.mark('rollbackCount');
      this.diagnostics.addTiming('rollbackTimes', rollback.durationMs);
      this.storage.addRollback({ ...rollback, success: true, sessionId: session.sessionId });
      this._emit(EVENTS.ROLLBACK_COMPLETED, { session: session.snapshot(), rollback });

      this._setState(RECOVERY_STATES.RESTORING_STATE);
      const restored = await this.coordinator.restoreState({ session: session.snapshot(), rollback, context });
      this._emit(EVENTS.STATE_RESTORED, { session: session.snapshot(), restored });

      this._setState(RECOVERY_STATES.RESTARTING);
      const restart = await this.coordinator.restart(context.restartOptions || {});
      session.restartCount += restart?.skipped ? 0 : 1;
      this._emit(EVENTS.APPLICATION_RESTARTED, { session: session.snapshot(), restart });

      const result = { rollback, restored, restart, durationMs: Date.now() - startedAt };
      session.finishRecovery(result);
      session.setState(RECOVERY_STATES.RECOVERY_COMPLETED);
      this.context = this.context.update({ running: false, lastResult: result, currentSession: session });
      this.diagnostics.mark('recoveryCount');
      this.diagnostics.mark('successfulRecoveries');
      this.diagnostics.addTiming('recoveryTimes', result.durationMs);
      this.diagnostics.lastRecoveryVersion = backup.currentVersion || null;
      this.storage.addHistory({ ...session.snapshot(), outcome: 'recovered', result });
      this.storage.clearPendingSession();
      this._setState(RECOVERY_STATES.RECOVERY_COMPLETED);
      this._emit(EVENTS.RECOVERY_COMPLETED, { session: session.snapshot(), result });
      return RecoveryResult.ok('recovery.completed', { session: session.snapshot(), result });
    } catch (rollbackError) {
      session.recordError(rollbackError);
      session.setState(RECOVERY_STATES.RECOVERY_FAILED);
      this.storage.addRollback({ success: false, sessionId: session.sessionId, error: rollbackError.message, code: rollbackError.code || null });
      this.storage.addHistory({ ...session.snapshot(), outcome: 'failed' });
      return this._fail('recovery.failed', rollbackError);
    }
  }

  shutdown() {
    this.context = this.context.update({ running: false });
    this._setState(RECOVERY_STATES.IDLE);
    return RecoveryResult.ok('recovery.shutdown', this.getStatus());
  }

  getStatus() {
    const backup = this.backupManager.getLatestBackup();
    return {
      state: this.state,
      initialized: this.context.initialized,
      running: this.context.running,
      configuration: this.configuration.toJSON(),
      currentSession: this.currentSession?.snapshot?.() || null,
      latestBackup: backup ? {
        backupId: backup.backupId,
        currentVersion: backup.currentVersion,
        targetVersion: backup.targetVersion,
        createdAt: backup.createdAt,
        fileCount: backup.files?.length || 0
      } : null,
      pendingSession: this.storage.readPendingSession()
    };
  }

  getDiagnostics() {
    return this.diagnostics.snapshot(this.getStatus());
  }

  getRollbackHistory() {
    return this.storage.listRollbacks();
  }

  _ensureSession(input = {}) {
    if (this.currentSession) return this.currentSession;
    const pending = this._loadPendingSession();
    this.currentSession = pending || new RecoverySession({
      currentVersion: input.currentVersion || this.currentVersionProvider(),
      previousVersion: input.previousVersion || input.currentVersion || '',
      targetVersion: input.targetVersion || '',
      failureReason: input.failureReason || ''
    });
    return this.currentSession;
  }

  _loadPendingSession() {
    const pending = this.storage.readPendingSession();
    return pending ? new RecoverySession(pending) : null;
  }

  _setState(state) {
    const previousState = this.state;
    this.state = state;
    if (this.currentSession) this.currentSession.setState(state);
    this.logger.info('State changed', { previousState, state });
    this._emit(EVENTS.STATE_CHANGED, { previousState, state });
  }

  _fail(type, error) {
    this.diagnostics.recordError(error);
    this.diagnostics.lastFailureReason = error?.message || String(error || type);
    this.diagnostics.mark('failedRecoveries');
    if (this.currentSession) this.currentSession.recordError(error);
    this.context = this.context.update({ running: false });
    this._setState(RECOVERY_STATES.ERROR);
    this._emit(EVENTS.ERROR, { type, error: error?.message || String(error), code: error?.code || null });
    this._emit(EVENTS.RECOVERY_FAILED, { type, error: error?.message || String(error), code: error?.code || null, session: this.currentSession?.snapshot?.() || null });
    return RecoveryResult.fail(type, error, this.getStatus());
  }

  _emit(event, payload) {
    this.emit(event, payload);
  }

  _recoveryRoot(directories = {}) {
    return path.join(directories.cacheDir || process.cwd(), 'recovery');
  }

  _backupRoot(directories = {}) {
    return path.join(this._recoveryRoot(directories), 'rollback');
  }
}

module.exports = RecoveryService;
