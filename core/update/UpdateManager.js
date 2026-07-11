const EventEmitter = require('events');
const { UPDATE_STATES } = require('./UpdateState');
const UPDATE_EVENTS = require('./UpdateEvents');
const { UpdateConfiguration } = require('./UpdateConfiguration');
const UpdateDiagnostics = require('./UpdateDiagnostics');
const UpdateDirectoryManager = require('./UpdateDirectoryManager');
const UpdateContext = require('./UpdateContext');
const VersionManager = require('./VersionManager');
const UpdateLogger = require('./UpdateLogger');
const { VersionCheckService, VERSION_CHECK_EVENTS } = require('./version');
const { UpdateNotificationManager } = require('./events');
const { DownloadManager } = require('./download');
const { VerificationManager } = require('./verification');
const { InstallationManager } = require('./install');
const { SelfUpdateManager, SelfUpdateEvents } = require('./selfupdate');
const { UpdatePresentationManager } = require('./presentation');
const { RecoveryManager, RecoveryEvents } = require('./recovery');
const {
  InitializationResult,
  StatusResult,
  DiagnosticResult,
  UpdateResult
} = require('./UpdateResult');

class UpdateManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = options.config || {};
    this.state = UPDATE_STATES.UNINITIALIZED;
    this.configuration = new UpdateConfiguration(options.update || this.config.update || {});
    this.logger = options.updateLogger || new UpdateLogger({
      logger: options.logger,
      enabled: this.configuration.loggingEnabled
    });
    this.diagnostics = options.diagnostics || new UpdateDiagnostics({
      enabled: this.configuration.diagnosticsEnabled
    });
    this.versionManager = options.versionManager || new VersionManager({
      packagePath: options.packagePath,
      metadata: options.metadata,
      logger: this.logger
    });
    this.directoryManager = options.directoryManager || new UpdateDirectoryManager({ config: this.config });
    this.context = new UpdateContext({ configuration: this.configuration, diagnostics: this.diagnostics, manager: this });
    this.versionCheckService = options.versionCheckService || new VersionCheckService({
      versionCheck: this.configuration.versionCheck.toJSON(),
      versionManager: this.versionManager,
      relayClient: options.relayClient,
      relayClientProvider: options.relayClientProvider,
      logger: this.logger
    });
    this.updateNotificationManager = options.updateNotificationManager || new UpdateNotificationManager({
      versionManager: this.versionManager,
      logger: this.logger,
      displayHandler: options.updateNotificationDisplayHandler,
      ackSender: options.updateNotificationAckSender,
      loggingEnabled: this.configuration.loggingEnabled,
      diagnosticsEnabled: this.configuration.diagnosticsEnabled
    });
    this.downloadManager = options.downloadManager || new DownloadManager({
      configuration: this.configuration.download,
      directories: this.directoryManager.getPaths(),
      logger: this.logger
    });
    this.verificationManager = options.verificationManager || new VerificationManager({
      configuration: this.configuration.verification,
      directories: this.directoryManager.getPaths(),
      versionManager: this.versionManager,
      logger: this.logger
    });
    this.installationManager = options.installationManager || new InstallationManager({
      configuration: this.configuration.installation,
      directories: this.directoryManager.getPaths(),
      versionManager: this.versionManager,
      logger: this.logger,
      confirm: options.installationConfirmationHandler,
      saveHandlers: options.installationSaveHandlers || [],
      shutdownHandlers: options.installationShutdownHandlers || [],
      launcher: options.installerLauncher,
      verificationProvider: () => this.verificationManager.latestResult,
      currentVersionProvider: () => this.context.version || this.versionManager.getCurrentVersion()?.data?.version || ''
    });
    this.selfUpdateManager = options.selfUpdateManager || new SelfUpdateManager({
      configuration: this.configuration.selfUpdate,
      directories: this.directoryManager.getPaths(),
      versionManager: this.versionManager,
      logger: this.logger,
      saveHandlers: options.selfUpdateSaveHandlers || options.installationSaveHandlers || [],
      shutdownHandlers: options.selfUpdateShutdownHandlers || options.installationShutdownHandlers || [],
      restoreHandlers: options.selfUpdateRestoreHandlers || [],
      recoveryHandlers: options.selfUpdateRecoveryHandlers || [],
      silentInstaller: options.silentInstaller,
      installationMonitor: options.selfUpdateInstallationMonitor,
      restartManager: options.restartManager,
      restartOptions: options.restartOptions,
      installerSpawn: options.selfUpdateInstallerSpawn,
      verificationProvider: () => this.verificationManager.latestResult,
      currentVersionProvider: () => this.context.version || this.versionManager.getCurrentVersion()?.data?.version || ''
    });
    this.recoveryManager = options.recoveryManager || new RecoveryManager({
      configuration: this.configuration.recovery,
      directories: this.directoryManager.getPaths(),
      versionManager: this.versionManager,
      logger: this.logger,
      restartManager: options.recoveryRestartManager || options.restartManager,
      restartOptions: options.restartOptions,
      backupPathsProvider: options.recoveryBackupPathsProvider || (() => options.recoveryBackupPaths || [process.execPath].filter(Boolean)),
      restoreHandlers: options.recoveryRestoreHandlers || [],
      currentVersionProvider: () => this.context.version || this.versionManager.getCurrentVersion()?.data?.version || ''
    });
    this.presentationManager = options.presentationManager || new UpdatePresentationManager({
      logger: this.logger,
      provider: {
        getSnapshot: () => this._statusData(),
        executeAction: (actionId, payload) => this.executePresentationAction(actionId, payload)
      }
    });
    this.history = [];
    this.providers = new Map();
    this._forwardVersionCheckEvents();
    this._forwardInstallationEvents();
    this._forwardSelfUpdateEvents();
    this._forwardRecoveryEvents();
  }

  initialize() {
    try {
      this._setState(UPDATE_STATES.INITIALIZING);
      const directories = this.directoryManager.ensureDirectories();
      const versionResult = this.versionManager.getCurrentVersion();
      this.diagnostics.markVersionRead();
      if (!versionResult.success) throw Object.assign(new Error(versionResult.error?.message || 'Version read failed'), { code: versionResult.error?.code || 'VERSION_READ_FAILED' });
      this.context = this.context.update({
        directories,
        version: versionResult.data.version,
        initialized: true,
        running: false
      });
      this.versionCheckService.initialize();
      this.downloadManager.initialize(directories);
      this.verificationManager.initialize(directories);
      this.installationManager.initialize(directories);
      this.selfUpdateManager.initialize(directories);
      this.recoveryManager.initialize(directories);
      this.diagnostics.markInitialized();
      this._setState(UPDATE_STATES.READY);
      const result = new InitializationResult({ data: this._statusData() });
      this.emit(UPDATE_EVENTS.INITIALIZED, result.data);
      return result;
    } catch (error) {
      return this._fail('update.initialization', error);
    }
  }

  start() {
    if (this.state === UPDATE_STATES.UNINITIALIZED) {
      const initialized = this.initialize();
      if (!initialized.success) return initialized;
    }
    try {
      this.context = this.context.update({ running: true });
      this.diagnostics.markStarted();
      this._setState(UPDATE_STATES.RUNNING);
      this.emit(UPDATE_EVENTS.STARTED, this._statusData());
      return new StatusResult({ data: this._statusData() });
    } catch (error) {
      return this._fail('update.start', error);
    }
  }

  shutdown() {
    try {
      this._setState(UPDATE_STATES.STOPPING);
      this.downloadManager.shutdown();
      this.installationManager.shutdown();
      this.selfUpdateManager.shutdown();
      this.recoveryManager.shutdown();
      this.verificationManager.shutdown();
      this.versionCheckService.shutdown();
      this.context = this.context.update({ running: false });
      this.diagnostics.markStopped();
      this._setState(UPDATE_STATES.STOPPED);
      this.emit(UPDATE_EVENTS.STOPPED, this._statusData());
      return new StatusResult({ data: this._statusData() });
    } catch (error) {
      return this._fail('update.shutdown', error);
    }
  }

  getStatus() {
    return new StatusResult({ data: this._statusData() });
  }

  getDiagnostics() {
    return new DiagnosticResult({ data: this.diagnostics.snapshot(this._statusData()) });
  }

  getVersion() {
    const result = this.versionManager.getCurrentVersion();
    this.diagnostics.markVersionRead();
    if (result.success) {
      this.context = this.context.update({ version: result.data.version });
      this.emit(UPDATE_EVENTS.VERSION_READ, result.data);
    }
    return result;
  }

  getCurrentState() {
    return this.state;
  }

  updateConfiguration(input = {}) {
    this.configuration = this.configuration.merge(input);
    this.context = this.context.update({ configuration: this.configuration });
    this.versionCheckService.manager.configuration = this.configuration.versionCheck;
    this.downloadManager.configuration = this.configuration.download;
    this.downloadManager.validator.configuration = this.configuration.download;
    this.downloadManager.engine.configuration = this.configuration.download;
    this.downloadManager.engine.retryManager.maxRetries = this.configuration.download.maxRetries;
    this.downloadManager.engine.retryManager.retryDelayMs = this.configuration.download.retryDelayMs;
    this.verificationManager.configuration = this.configuration.verification;
    this.verificationManager.engine.configuration = this.configuration.verification;
    this.installationManager.configuration = this.configuration.installation;
    this.installationManager.policy.configuration = this.configuration.installation;
    this.installationManager.validator.configuration = this.configuration.installation;
    this.selfUpdateManager.updateConfiguration(this.configuration.selfUpdate);
    this.recoveryManager.updateConfiguration(this.configuration.recovery);
    this.emit(UPDATE_EVENTS.CONFIG_CHANGED, this.configuration.toJSON());
    return new StatusResult({ data: this._statusData() });
  }

  getPresentation(context = {}) {
    return new StatusResult({ data: this.presentationManager.getPresentation(context) });
  }

  getReleaseNotes() {
    return new StatusResult({ data: this.presentationManager.getReleaseNotes() });
  }

  getProgress() {
    return new StatusResult({ data: this.presentationManager.getProgress() });
  }

  getActions() {
    return new StatusResult({ data: this.presentationManager.getActions() });
  }

  async executePresentationAction(actionId, payload = {}) {
    const id = String(actionId || payload.actionId || '').trim();
    if (!id) return UpdateResult.fail('update.presentation.action.invalid', new Error('Update action is required.'));

    if (id === 'check' || id === 'refresh') {
      return this.checkVersionNow({ source: 'presentation', requestedBy: payload.source || 'ui' });
    }

    if (id === 'download') {
      const assetUrl = payload.assetUrl || payload.url || payload.asset?.url;
      if (!assetUrl) {
        return UpdateResult.fail('update.presentation.download.unavailable', new Error('No relay-provided update asset is selected.'));
      }
      return this.startDownload({
        ...payload,
        assetUrl,
        url: assetUrl,
        source: 'relay',
        relayProvided: true
      });
    }

    if (id === 'pause') return this.pauseDownload(payload.taskId || this._latestDownloadTaskId());
    if (id === 'resume') return this.resumeDownload(payload.taskId || this._latestDownloadTaskId());
    if (id === 'cancel') return this.cancelDownload(payload.taskId || this._latestDownloadTaskId());

    if (id === 'install') return this.install({ source: payload.source || 'presentation' });
    if (id === 'selfUpdate') return this.selfUpdate({ source: payload.source || 'presentation', approved: true });

    if (id === 'viewReleaseNotes') {
      return UpdateResult.ok('update.presentation.releaseNotes', this.presentationManager.getReleaseNotes());
    }

    if (id === 'copyVersion') {
      return UpdateResult.ok('update.presentation.version', this.presentationManager.getPresentation({ source: 'copy-version' }).model.version);
    }

    if (id === 'openDownloadsFolder') {
      return UpdateResult.ok('update.presentation.openDownloadsFolder', { path: this.context.directories?.downloadsDir || this.directoryManager.getPaths().downloadsDir || '' });
    }

    if (id === 'openLogsFolder') {
      return UpdateResult.ok('update.presentation.openLogsFolder', { path: this.context.directories?.logsDir || this.directoryManager.getPaths().logsDir || '' });
    }

    if (id === 'dismiss') {
      return UpdateResult.ok('update.presentation.dismiss', { dismissed: true });
    }

    return UpdateResult.fail('update.presentation.action.unsupported', new Error(`Unsupported update action: ${id}`));
  }

  async executePresentationActionFromUi(actionId, payload = {}) {
    const result = await this.presentationManager.executeAction(actionId, payload);
    return new StatusResult({ data: result });
  }

  getPresentationStatus() {
    return new StatusResult({ data: this.presentationManager.getStatus() });
  }

  getPresentationDiagnostics() {
    return new DiagnosticResult({ data: this.presentationManager.getDiagnostics() });
  }

  assistantUpdateRequest(command = '', source = 'assistant') {
    const text = String(command || '').toLowerCase();
    const requestedSource = source === 'voice' ? 'voice' : 'assistant';
    const presentation = this.presentationManager.assistantRequest(command, requestedSource);
    if (/\b(download|start download)\b/.test(text)) {
      return this.presentationManager.executeAction('download', { source: requestedSource });
    }
    if (/\bpause\b/.test(text)) return this.presentationManager.executeAction('pause', { source: requestedSource });
    if (/\bresume\b/.test(text)) return this.presentationManager.executeAction('resume', { source: requestedSource });
    if (/\bcancel\b/.test(text)) return this.presentationManager.executeAction('cancel', { source: requestedSource });
    if (/\b(check|latest|available|update status)\b/.test(text)) {
      return this.presentationManager.executeAction('check', { source: requestedSource });
    }
    return UpdateResult.ok('update.presentation.assistant', presentation);
  }

  setRelayClient(clientOrProvider) {
    this.versionCheckService.setRelayClient(clientOrProvider);
    return new StatusResult({ data: this._statusData() });
  }

  checkVersionNow(options = {}) {
    return this.versionCheckService.checkNow(options);
  }

  checkVersionOnStartup(options = {}) {
    return this.versionCheckService.checkOnStartup(options);
  }

  getVersionCheckStatus() {
    return new StatusResult({ data: this.versionCheckService.getStatus() });
  }

  getVersionCheckDiagnostics() {
    return new DiagnosticResult({ data: this.versionCheckService.getDiagnostics() });
  }

  setUpdateNotificationDisplayHandler(handler) {
    this.updateNotificationManager.setDisplayHandler(handler);
    return new StatusResult({ data: this._statusData() });
  }

  setUpdateNotificationAckSender(sender) {
    this.updateNotificationManager.setAckSender(sender);
    return new StatusResult({ data: this._statusData() });
  }

  handleUpdateAvailableEvent(event = {}) {
    return this.updateNotificationManager.handleEvent(event);
  }

  getUpdateNotificationStatus() {
    return new StatusResult({ data: this.updateNotificationManager.getStatus() });
  }

  getUpdateNotificationDiagnostics() {
    return new DiagnosticResult({ data: this.updateNotificationManager.getDiagnostics() });
  }

  startDownload(input = {}) {
    return this.downloadManager.startDownload(input);
  }

  pauseDownload(taskId) {
    return this.downloadManager.pauseDownload(taskId);
  }

  resumeDownload(taskId) {
    return this.downloadManager.resumeDownload(taskId);
  }

  cancelDownload(taskId) {
    return this.downloadManager.cancelDownload(taskId);
  }

  removeDownload(taskId) {
    return this.downloadManager.removeDownload(taskId);
  }

  getDownloadStatus(taskId = '') {
    return new StatusResult({ data: this.downloadManager.getStatus(taskId) });
  }

  getDownloadDiagnostics() {
    return new DiagnosticResult({ data: this.downloadManager.getDiagnostics() });
  }

  verifyPackage(input = {}) {
    return this.verificationManager.verify(input);
  }

  getVerificationStatus() {
    return new StatusResult({ data: this.verificationManager.getStatus() });
  }

  getVerificationDiagnostics() {
    return new DiagnosticResult({ data: this.verificationManager.getDiagnostics() });
  }

  install(input = {}) {
    return this.installationManager.install(input);
  }

  cancelInstallation(reason = 'cancelled') {
    return this.installationManager.cancel(reason);
  }

  getInstallationStatus() {
    return new StatusResult({ data: this.installationManager.getStatus() });
  }

  getInstallationDiagnostics() {
    return new DiagnosticResult({ data: this.installationManager.getDiagnostics() });
  }

  async selfUpdate(input = {}) {
    const currentVersion = input.currentVersion || this.context.version || this.versionManager.getCurrentVersion()?.data?.version || '';
    const verificationResult = input.verificationResult || this.verificationManager.latestResult || null;
    const targetVersion = input.targetVersion
      || verificationResult?.data?.manifest?.version
      || verificationResult?.data?.version
      || verificationResult?.installerVersion
      || '';
    const backupResult = this.recoveryManager.createBackupForUpdate({
      currentVersion,
      targetVersion,
      source: input.source || 'self-update',
      sourcePaths: input.recoverySourcePaths || input.sourcePaths
    });
    if (backupResult?.success === false) {
      return UpdateResult.fail('selfUpdate.recoveryBackup.failed', backupResult.error || new Error('Recovery backup failed.'), {
        recovery: backupResult.data || {}
      });
    }
    this.recoveryManager.markInstalling({ currentVersion, targetVersion });
    const result = await this.selfUpdateManager.selfUpdate({ ...input, currentVersion, verificationResult });
    if (!result?.success) {
      await this.recoveryManager.handleInstallationFailure(result?.error || new Error('Self update failed.'), {
        selfUpdateResult: result,
        currentVersion,
        targetVersion
      });
      return result;
    }
    this.recoveryManager.markStartupValidationPending({
      currentVersion,
      targetVersion,
      selfUpdateResult: result
    });
    return result;
  }

  getSelfUpdateStatus() {
    return new StatusResult({ data: this.selfUpdateManager.getStatus() });
  }

  getSelfUpdateDiagnostics() {
    return new DiagnosticResult({ data: this.selfUpdateManager.getDiagnostics() });
  }

  getRecoveryStatus() {
    return new StatusResult({ data: this.recoveryManager.getStatus() });
  }

  getRecoveryDiagnostics() {
    return new DiagnosticResult({ data: this.recoveryManager.getDiagnostics() });
  }

  getRollbackHistory() {
    return new StatusResult({ data: this.recoveryManager.getRollbackHistory() });
  }

  validateStartup(input = {}) {
    return this.recoveryManager.validateStartup(input);
  }

  handleStartupFailure(error, context = {}) {
    return this.recoveryManager.handleStartupFailure(error, context);
  }

  registerProvider(id, provider) {
    const key = String(id || '').trim().toLowerCase();
    if (!key) return UpdateResult.fail('update.provider.register', new Error('Provider id is required'));
    this.providers.set(key, provider);
    return UpdateResult.ok('update.provider.register', { provider: key, count: this.providers.size });
  }

  _setState(nextState) {
    const previousState = this.state;
    this.state = nextState;
    this.diagnostics.markStateChanged();
    this.logger.info('State changed', { previousState, state: nextState });
    this.emit(UPDATE_EVENTS.STATE_CHANGED, { previousState, state: nextState });
  }

  _statusData() {
    return {
      state: this.state,
      initialized: this.context.initialized,
      running: this.context.running,
      configuration: this.configuration.toJSON(),
      version: this.context.version,
      directories: this.context.directories,
      history: this.history.slice(),
      providers: Array.from(this.providers.keys()),
      versionCheck: this.versionCheckService.getStatus(),
      updateNotifications: this.updateNotificationManager.getStatus(),
      downloads: this.downloadManager.getStatus(),
      verification: this.verificationManager.getStatus(),
      installation: this.installationManager.getStatus(),
      selfUpdate: this.selfUpdateManager.getStatus(),
      recovery: this.recoveryManager.getStatus(),
      presentation: this.presentationManager.getStatus()
    };
  }

  _latestDownloadTaskId() {
    const status = this.downloadManager.getStatus();
    const task = status?.active?.[0] || status?.queued?.[0] || status?.tasks?.[0] || status?.history?.[0] || null;
    return task?.id || '';
  }

  _forwardVersionCheckEvents() {
    for (const [name, eventName] of Object.entries(VERSION_CHECK_EVENTS)) {
      this.versionCheckService.on(eventName, payload => {
        const updateEvent = UPDATE_EVENTS[name] || eventName;
        this.emit(updateEvent, payload);
      });
    }
  }

  _forwardInstallationEvents() {
    const { InstallationEvents } = require('./install');
    for (const eventName of Object.values(InstallationEvents)) {
      this.installationManager.on(eventName, payload => this.emit(eventName, payload));
    }
  }

  _forwardSelfUpdateEvents() {
    for (const eventName of Object.values(SelfUpdateEvents)) {
      this.selfUpdateManager.on(eventName, payload => this.emit(eventName, payload));
    }
  }

  _forwardRecoveryEvents() {
    for (const eventName of Object.values(RecoveryEvents)) {
      this.recoveryManager.on(eventName, payload => this.emit(eventName, payload));
    }
  }

  _fail(type, error) {
    this.diagnostics.recordError(error);
    this._setState(UPDATE_STATES.ERROR);
    this.logger.error('Operation failed', { type, error: error.message });
    this.emit(UPDATE_EVENTS.ERROR, { type, error: error.message, code: error.code || null });
    return UpdateResult.fail(type, error, this._statusData());
  }
}

module.exports = UpdateManager;
