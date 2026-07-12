const EventEmitter = require('events');
const path = require('path');
const STATES = require('./InstallationState');
const EVENTS = require('./InstallationEvents');
const InstallationResult = require('./InstallationResult');
const { InstallationConfiguration } = require('./InstallationConfiguration');
const InstallationContext = require('./InstallationContext');
const InstallationDiagnostics = require('./InstallationDiagnostics');
const InstallationHistory = require('./InstallationHistory');
const InstallationLogger = require('./InstallationLogger');
const InstallationPolicy = require('./InstallationPolicy');
const InstallationSession = require('./InstallationSession');
const InstallationValidator = require('./InstallationValidator');
const ConfirmationManager = require('./ConfirmationManager');
const ShutdownCoordinator = require('./ShutdownCoordinator');
const ApplicationStateManager = require('./ApplicationStateManager');
const InstallerLauncher = require('./InstallerLauncher');

class InstallationManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.configuration = options.configuration instanceof InstallationConfiguration
      ? options.configuration
      : new InstallationConfiguration(options.installation || options.configuration || {});
    this.state = STATES.UNINITIALIZED;
    this.directories = options.directories || {};
    this.versionManager = options.versionManager || null;
    this.verificationProvider = options.verificationProvider || (() => null);
    this.currentVersionProvider = options.currentVersionProvider || (() => '');
    this.logger = options.installationLogger || new InstallationLogger({
      logger: options.logger,
      enabled: this.configuration.loggingEnabled
    });
    this.diagnostics = options.diagnostics || new InstallationDiagnostics({
      enabled: this.configuration.diagnosticsEnabled
    });
    this.history = options.history || new InstallationHistory({
      historyPath: this.directories.cacheDir ? path.join(this.directories.cacheDir, 'installation-history.json') : '',
      limit: this.configuration.historyLimit
    });
    this.policy = options.policy || new InstallationPolicy(this.configuration);
    this.validator = options.validator || new InstallationValidator({
      configuration: this.configuration,
      versionManager: this.versionManager,
      directories: this.directories
    });
    this.confirmationManager = options.confirmationManager || new ConfirmationManager({
      confirm: options.confirm
    });
    this.shutdownCoordinator = options.shutdownCoordinator || new ShutdownCoordinator({
      applicationStateManager: options.applicationStateManager || new ApplicationStateManager({
        saveHandlers: options.saveHandlers || []
      }),
      shutdownHandlers: options.shutdownHandlers || []
    });
    this.launcher = options.launcher || new InstallerLauncher(options.launcherOptions || {});
    this.context = new InstallationContext();
    this.currentSession = null;
    this.cancelledSessions = new Set();
  }

  initialize(directories = this.directories) {
    this.directories = directories || this.directories;
    this.history.historyPath = this.directories.cacheDir ? path.join(this.directories.cacheDir, 'installation-history.json') : this.history.historyPath;
    this.history.ensure();
    this.validator.directories = this.directories;
    this.context = this.context.update({ initialized: true, directories: this.directories });
    this._setState(STATES.READY);
    return InstallationResult.ok('installation.initialized', this.getStatus());
  }

  async install(input = {}) {
    this.diagnostics.mark('installAttempts');
    this._setState(STATES.IDLE);
    const policy = this.policy.evaluate({ running: this.context.running });
    if (!policy.allowed) return this._fail('installation.policy', this._error(policy.code, policy.message));

    this._setState(STATES.READY);
    this._emit(EVENTS.INSTALL_REQUESTED, input);
    try {
      const verificationResult = input.verificationResult || this.verificationProvider();
      const currentVersion = input.currentVersion || this.currentVersionProvider();
      const ready = this.validator.validate({
        ...input,
        verificationResult,
        currentVersion
      });
      const session = new InstallationSession({
        installerPath: ready.installerPath,
        installerVersion: ready.installerVersion,
        currentVersion: ready.currentVersion
      });
      this.currentSession = session;
      this.context = this.context.update({ running: true, currentVersion: ready.currentVersion, latestVerification: verificationResult });

      this._setState(STATES.WAITING_CONFIRMATION);
      const confirmation = await this.confirmationManager.request(session, ready);
      if (!confirmation.confirmed || this.cancelledSessions.has(session.sessionId)) {
        if (session.result !== 'CANCELLED') {
          session.finish('CANCELLED');
          this.diagnostics.mark('cancelledInstalls');
          this.history.add(session.snapshot());
        }
        this.context = this.context.update({ running: false });
        this._setState(STATES.CANCELLED);
        this._emit(EVENTS.INSTALL_CANCELLED, { session: session.snapshot(), reason: confirmation.reason || 'cancelled' });
        return InstallationResult.ok('installation.cancelled', { session: session.snapshot(), reason: confirmation.reason || 'cancelled' });
      }

      session.confirm();
      this._setState(STATES.CONFIRMED);
      this._emit(EVENTS.INSTALL_CONFIRMED, { session: session.snapshot() });

      this._setState(STATES.PREPARING);
      this._emit(EVENTS.PREPARATION_STARTED, { session: session.snapshot() });
      const preparationStartedAt = Date.now();
      const shutdownResult = await this.shutdownCoordinator.prepare({ session: session.snapshot(), installer: ready });
      this.diagnostics.addTiming('preparationTimes', Date.now() - preparationStartedAt);
      this.diagnostics.addTiming('shutdownTimes', shutdownResult.durationMs);
      this._emit(EVENTS.PREPARATION_COMPLETED, { session: session.snapshot(), shutdown: shutdownResult });

      this._setState(STATES.SHUTTING_DOWN);
      this._emit(EVENTS.SHUTDOWN_STARTED, { session: session.snapshot() });
      this._emit(EVENTS.SHUTDOWN_COMPLETED, { session: session.snapshot(), shutdown: shutdownResult });

      this._setState(STATES.LAUNCHING_INSTALLER);
      const launchStartedAt = Date.now();
      const launched = this.launcher.launch({
        installerPath: ready.installerPath,
        args: input.args || this.configuration.allowedInstallerArgs,
        workingDirectory: ready.workingDirectory,
        onExit: exit => {
          this.diagnostics.recordExitCode(exit?.code ?? null);
          this._emit(EVENTS.INSTALLER_EXITED, {
            session: session.snapshot(),
            exitCode: exit?.code ?? null,
            signal: exit?.signal || null,
            error: exit?.error || null
          });
        }
      });
      this.diagnostics.addTiming('launchTimes', Date.now() - launchStartedAt);
      session.launched();
      this._emit(EVENTS.INSTALLER_LAUNCHED, {
        session: session.snapshot(),
        pid: launched.pid,
        command: launched.command,
        args: launched.args
      });

      this._setState(STATES.INSTALLER_RUNNING);
      session.finish('LAUNCHED');
      this.diagnostics.mark('successfulInstalls');
      this.history.add(session.snapshot());
      this.context = this.context.update({ running: false });
      this._setState(STATES.COMPLETED);
      this._emit(EVENTS.INSTALLATION_COMPLETED, { session: session.snapshot(), pid: launched.pid });
      return InstallationResult.ok('installation.launched', { session: session.snapshot(), pid: launched.pid, command: launched.command, args: launched.args });
    } catch (error) {
      return this._fail('installation.failed', error);
    }
  }

  cancel(reason = 'cancelled') {
    if (this.currentSession && this.context.running) {
      this.cancelledSessions.add(this.currentSession.sessionId);
      this.currentSession.finish('CANCELLED');
      this.history.add(this.currentSession.snapshot());
    }
    this.context = this.context.update({ running: false });
    this.diagnostics.mark('cancelledInstalls');
    this._setState(STATES.CANCELLED);
    this._emit(EVENTS.INSTALL_CANCELLED, { reason });
    return InstallationResult.ok('installation.cancelled', { reason, session: this.currentSession?.snapshot?.() || null });
  }

  shutdown() {
    this.context = this.context.update({ running: false });
    this._setState(STATES.IDLE);
    return InstallationResult.ok('installation.shutdown', this.getStatus());
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

  _fail(type, error) {
    this.diagnostics.mark('failedInstalls');
    this.diagnostics.recordError(error);
    if (this.currentSession) {
      this.currentSession.fail(error);
      this.history.add(this.currentSession.snapshot());
    }
    this.context = this.context.update({ running: false });
    this._setState(STATES.FAILED);
    this._emit(EVENTS.INSTALLATION_FAILED, { error: error.message, code: error.code || null, session: this.currentSession?.snapshot?.() || null });
    this.logger.error('Installation failed', { type, error: error.message, code: error.code || null });
    return InstallationResult.fail(type, error, this.getStatus());
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

  _error(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
  }
}

module.exports = InstallationManager;
