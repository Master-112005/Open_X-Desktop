const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const { SELF_UPDATE_STATES } = require('./SelfUpdateState');
const EVENTS = require('./SelfUpdateEvents');
const SelfUpdateResult = require('./SelfUpdateResult');
const { SelfUpdateConfiguration } = require('./SelfUpdateConfiguration');
const SelfUpdateLogger = require('./SelfUpdateLogger');
const SelfUpdateDiagnostics = require('./SelfUpdateDiagnostics');
const SelfUpdatePolicy = require('./SelfUpdatePolicy');
const SelfUpdateSession = require('./SelfUpdateSession');
const SelfUpdateContext = require('./SelfUpdateContext');
const SelfUpdateHistory = require('./SelfUpdateHistory');
const StatePreserver = require('./StatePreserver');
const SilentInstaller = require('./SilentInstaller');
const InstallationMonitor = require('./InstallationMonitor');
const RestartManager = require('./RestartManager');
const ApplicationRestorer = require('./ApplicationRestorer');
const RecoveryCoordinator = require('./RecoveryCoordinator');
const InstallationValidator = require('../install/InstallationValidator');

function makeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

class SelfUpdateService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.configuration = options.configuration instanceof SelfUpdateConfiguration
      ? options.configuration
      : new SelfUpdateConfiguration(options.selfUpdate || options.configuration || {});
    this.state = SELF_UPDATE_STATES.UNINITIALIZED;
    this.directories = options.directories || {};
    this.versionManager = options.versionManager || null;
    this.verificationProvider = options.verificationProvider || (() => null);
    this.currentVersionProvider = options.currentVersionProvider || (() => '');
    this.logger = options.selfUpdateLogger || new SelfUpdateLogger({
      logger: options.logger,
      enabled: this.configuration.loggingEnabled
    });
    this.diagnostics = options.diagnostics || new SelfUpdateDiagnostics({
      enabled: this.configuration.diagnosticsEnabled
    });
    this.history = options.history || new SelfUpdateHistory({
      historyPath: this.directories.cacheDir ? path.join(this.directories.cacheDir, 'self-update-history.json') : '',
      limit: this.configuration.historyLimit
    });
    this.policy = options.policy || new SelfUpdatePolicy(this.configuration);
    this.validator = options.validator || new InstallationValidator({
      configuration: this.configuration,
      versionManager: this.versionManager,
      directories: this.directories
    });
    this.statePreserver = options.statePreserver || new StatePreserver({
      handlers: options.saveHandlers || [],
      statePath: this.directories.cacheDir ? path.join(this.directories.cacheDir, 'self-update-state.json') : ''
    });
    this.shutdownHandlers = Array.isArray(options.shutdownHandlers) ? options.shutdownHandlers : [];
    this.silentInstaller = options.silentInstaller || new SilentInstaller({
      configuration: this.configuration,
      spawn: options.installerSpawn
    });
    this.installationMonitor = options.installationMonitor || new InstallationMonitor({
      timeoutMs: this.configuration.monitorTimeoutMs
    });
    this.restartManager = options.restartManager || new RestartManager({
      ...(options.restartOptions || {}),
      waitMs: this.configuration.restartWaitMs
    });
    this.applicationRestorer = options.applicationRestorer || new ApplicationRestorer({
      handlers: options.restoreHandlers || []
    });
    this.recoveryCoordinator = options.recoveryCoordinator || new RecoveryCoordinator({
      handlers: options.recoveryHandlers || []
    });
    this.diskSpaceProvider = options.diskSpaceProvider || null;
    this.context = new SelfUpdateContext();
    this.currentSession = null;
  }

  initialize(directories = this.directories) {
    this.directories = directories || this.directories;
    this.history.historyPath = this.directories.cacheDir ? path.join(this.directories.cacheDir, 'self-update-history.json') : this.history.historyPath;
    this.history.limit = this.configuration.historyLimit;
    this.history.ensure();
    this.validator.directories = this.directories;
    this.statePreserver.statePath = this.directories.cacheDir ? path.join(this.directories.cacheDir, 'self-update-state.json') : this.statePreserver.statePath;
    this.context = this.context.update({ initialized: true, directories: this.directories });
    this._setState(SELF_UPDATE_STATES.READY);
    return SelfUpdateResult.ok('selfUpdate.initialized', this.getStatus());
  }

  updateConfiguration(configuration) {
    this.configuration = configuration instanceof SelfUpdateConfiguration
      ? configuration
      : new SelfUpdateConfiguration(configuration || {});
    this.policy.configuration = this.configuration;
    this.validator.configuration = this.configuration;
    this.silentInstaller.configuration = this.configuration;
    this.installationMonitor.monitor.timeoutMs = this.configuration.monitorTimeoutMs;
    this.restartManager.updateOptions({ waitMs: this.configuration.restartWaitMs });
  }

  async selfUpdate(input = {}) {
    const policy = this.policy.evaluate({ running: this.context.running });
    if (!policy.allowed) return this._fail('selfUpdate.policy', makeError(policy.code, policy.message));
    if (input.approved !== true && this.configuration.futureAutomaticRestart !== true) {
      return this._fail('selfUpdate.approval', makeError('APPROVAL_REQUIRED', 'Self update requires an approved user restart request.'));
    }

    this.context = this.context.update({ running: true });
    this._setState(SELF_UPDATE_STATES.PREPARING);
    try {
      const verificationResult = input.verificationResult || this.verificationProvider();
      const currentVersion = input.currentVersion || this.currentVersionProvider();
      const ready = this.validator.validate({
        ...input,
        verificationResult,
        currentVersion
      });
      const preparation = this._verifyPreparationReadiness(ready);
      const session = new SelfUpdateSession({
        installerPath: ready.installerPath,
        installerVersion: ready.installerVersion,
        targetVersion: ready.installerVersion,
        currentVersion: ready.currentVersion
      });
      this.currentSession = session;
      this.context = this.context.update({ latestVerification: verificationResult });
      this._emit(EVENTS.SELF_UPDATE_STARTED, { session: session.snapshot(), source: input.source || 'unknown' });
      this._emit(EVENTS.PREPARATION_COMPLETED, { session: session.snapshot(), installer: ready, preparation });
      this.logger.info('Preparation completed', {
        sessionId: session.sessionId,
        currentVersion: session.currentVersion,
        targetVersion: session.targetVersion,
        installerPath: session.installerPath,
        diskSpace: preparation.diskSpace
      });

      this._setState(SELF_UPDATE_STATES.PRESERVING_STATE);
      const preserved = this.configuration.preserveSession === false
        ? { success: true, skipped: true, durationMs: 0, handlers: [] }
        : await this.statePreserver.preserve({ session: session.snapshot(), installer: ready, source: input.source || 'unknown' });
      this._emit(EVENTS.STATE_SAVED, { session: session.snapshot(), state: preserved });
      this.logger.info('Runtime state preserved', { sessionId: session.sessionId, durationMs: preserved.durationMs });

      this._setState(SELF_UPDATE_STATES.SHUTTING_DOWN);
      const shutdown = await this._gracefulShutdown({ session: session.snapshot(), installer: ready, preserved });
      session.markShutdown();
      this._emit(EVENTS.SHUTDOWN_COMPLETED, { session: session.snapshot(), shutdown });
      this.logger.info('Graceful shutdown completed', { sessionId: session.sessionId, durationMs: shutdown.durationMs });

      this._setState(SELF_UPDATE_STATES.INSTALLER_STARTING);
      const launch = this.silentInstaller.launch({
        installerPath: ready.installerPath,
        workingDirectory: ready.workingDirectory,
        args: input.silentArgs
      });
      session.markInstallStarted();
      this._emit(EVENTS.INSTALLER_STARTED, {
        session: session.snapshot(),
        pid: launch.pid,
        command: launch.command,
        args: launch.args,
        visibility: launch.visibility
      });
      this.logger.info('Silent installer started', {
        sessionId: session.sessionId,
        pid: launch.pid,
        command: launch.command,
        args: launch.args,
        visibility: launch.visibility
      });

      this._setState(SELF_UPDATE_STATES.INSTALLER_RUNNING);
      const installResult = await this.installationMonitor.waitForInstaller(launch.process, {
        timeoutMs: this.configuration.monitorTimeoutMs
      });
      this.diagnostics.recordExitCode(installResult.exitCode ?? null);
      this.diagnostics.addTiming('installationTimes', installResult.durationMs);
      if (!installResult.success) {
        this.diagnostics.mark('installerFailures');
        throw makeError('INSTALLER_FAILED', installResult.error || `Silent installer exited with code ${installResult.exitCode}`);
      }
      this._emit(EVENTS.INSTALLER_COMPLETED, { session: session.snapshot(), installer: installResult });
      this.logger.info('Silent installer completed', { sessionId: session.sessionId, exitCode: installResult.exitCode, durationMs: installResult.durationMs });

      this._setState(SELF_UPDATE_STATES.RESTARTING);
      const restart = await this.restartManager.restart(input.restartOptions || {});
      session.markRestart();
      this.diagnostics.addTiming('restartTimes', restart.durationMs);
      this._emit(EVENTS.RESTART_STARTED, { session: session.snapshot(), restart });
      this.logger.info('Restart launched', { sessionId: session.sessionId, pid: restart.pid, executablePath: restart.executablePath });

      this._setState(SELF_UPDATE_STATES.RESTORING);
      const restored = await this.applicationRestorer.restore({ session: session.snapshot(), preserved, restart });
      this._emit(EVENTS.APPLICATION_RESTORED, { session: session.snapshot(), restored });

      session.finish('COMPLETED', installResult.exitCode);
      this.diagnostics.recordSuccess(session.snapshot());
      this.history.add(session.snapshot());
      this.context = this.context.update({ running: false });
      this._setState(SELF_UPDATE_STATES.COMPLETED);
      this._emit(EVENTS.SELF_UPDATE_COMPLETED, { session: session.snapshot(), installer: installResult, restart, restored });
      return SelfUpdateResult.ok('selfUpdate.completed', {
        session: session.snapshot(),
        installer: installResult,
        restart,
        restored,
        visibility: launch.visibility
      });
    } catch (error) {
      return this._fail('selfUpdate.failed', error);
    }
  }

  shutdown() {
    this.context = this.context.update({ running: false });
    this._setState(SELF_UPDATE_STATES.IDLE);
    return SelfUpdateResult.ok('selfUpdate.shutdown', this.getStatus());
  }

  getStatus() {
    return {
      state: this.state,
      initialized: this.context.initialized,
      running: this.context.running,
      configuration: this.configuration.toJSON(),
      currentSession: this.currentSession?.snapshot?.() || null,
      history: this.history.list().slice(0, this.configuration.historyLimit)
    };
  }

  getDiagnostics() {
    return this.diagnostics.snapshot(this.getStatus());
  }

  async _gracefulShutdown(context = {}) {
    const startedAt = Date.now();
    const results = [];
    for (const handler of this.shutdownHandlers) {
      if (typeof handler !== 'function') continue;
      const handlerStartedAt = Date.now();
      try {
        await handler(context);
        results.push({ success: true, durationMs: Date.now() - handlerStartedAt });
      } catch (error) {
        results.push({ success: false, error: error.message, durationMs: Date.now() - handlerStartedAt });
        throw error;
      }
    }
    return { success: true, durationMs: Date.now() - startedAt, handlers: results };
  }

  _verifyPreparationReadiness(ready = {}) {
    fs.accessSync(ready.installerPath, fs.constants.R_OK);
    const installerStats = fs.statSync(ready.installerPath);
    if (!installerStats.isFile() || installerStats.size <= 0) {
      throw makeError('INSTALLER_EMPTY', 'Verified installer is empty or unreadable.');
    }
    const diskSpace = this._checkDiskSpace(ready.workingDirectory, installerStats.size);
    return {
      installerReadable: true,
      installerSize: installerStats.size,
      diskSpace
    };
  }

  _checkDiskSpace(directory, installerSize) {
    const minimumFreeBytes = Math.max(installerSize * 2, 64 * 1024 * 1024);
    let freeBytes = null;
    if (typeof this.diskSpaceProvider === 'function') {
      freeBytes = Number(this.diskSpaceProvider(directory));
    } else if (typeof fs.statfsSync === 'function') {
      const stats = fs.statfsSync(directory);
      freeBytes = Number(stats.bavail || stats.bfree || 0) * Number(stats.bsize || 0);
    }
    if (Number.isFinite(freeBytes) && freeBytes > 0 && freeBytes < minimumFreeBytes) {
      throw makeError('INSUFFICIENT_DISK_SPACE', 'Not enough free disk space to install the verified update.');
    }
    return {
      checked: Number.isFinite(freeBytes) && freeBytes > 0,
      freeBytes: Number.isFinite(freeBytes) && freeBytes > 0 ? freeBytes : null,
      requiredBytes: minimumFreeBytes
    };
  }

  async _recover(error) {
    try {
      const recovery = await this.recoveryCoordinator.recover({ error, session: this.currentSession?.snapshot?.() || null });
      this.diagnostics.recoveryCount = this.recoveryCoordinator.recoveryCount;
      return recovery;
    } catch (_) {
      return null;
    }
  }

  _fail(type, error) {
    this.diagnostics.mark('failedUpdates');
    this.diagnostics.recordError(error);
    if (this.currentSession) {
      this.currentSession.fail(error);
      this.history.add(this.currentSession.snapshot());
    }
    this.context = this.context.update({ running: false });
    this._setState(SELF_UPDATE_STATES.FAILED);
    this._recover(error).catch(() => {});
    this._emit(EVENTS.SELF_UPDATE_FAILED, { error: error.message, code: error.code || null, session: this.currentSession?.snapshot?.() || null });
    this._emit(EVENTS.ERROR, { type, error: error.message, code: error.code || null });
    this.logger.error('Self update failed', { type, error: error.message, code: error.code || null });
    return SelfUpdateResult.fail(type, error, this.getStatus());
  }

  _setState(state) {
    const previousState = this.state;
    this.state = state;
    this._emit(EVENTS.STATE_CHANGED, { previousState, state });
    this.logger.info('State changed', { previousState, state });
  }

  _emit(event, payload) {
    this.emit(event, payload);
  }
}

module.exports = SelfUpdateService;
