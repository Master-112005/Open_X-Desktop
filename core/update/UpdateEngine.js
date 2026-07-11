const EventEmitter = require('events');
const UpdateManager = require('./UpdateManager');

class UpdateEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.manager = options.manager || new UpdateManager(options);
    this.initialized = false;
    this.running = false;
    this._forwardEvents();
  }

  initialize() {
    const result = this.manager.initialize();
    this.initialized = result.success === true;
    this.running = this.manager.context.running;
    return result;
  }

  start() {
    const result = this.manager.start();
    this.initialized = this.manager.context.initialized;
    this.running = result.success === true && this.manager.context.running;
    return result;
  }

  shutdown() {
    const result = this.manager.shutdown();
    this.running = false;
    return result;
  }

  getStatus() {
    return this.manager.getStatus();
  }

  getVersion() {
    return this.manager.getVersion();
  }

  getCurrentState() {
    return this.manager.getCurrentState();
  }

  isInitialized() {
    return this.initialized === true || this.manager.context.initialized === true;
  }

  isRunning() {
    return this.running === true || this.manager.context.running === true;
  }

  getDiagnostics() {
    return this.manager.getDiagnostics();
  }

  setRelayClient(clientOrProvider) {
    return this.manager.setRelayClient(clientOrProvider);
  }

  checkVersionNow(options = {}) {
    return this.manager.checkVersionNow(options);
  }

  checkVersionOnStartup(options = {}) {
    return this.manager.checkVersionOnStartup(options);
  }

  getVersionCheckStatus() {
    return this.manager.getVersionCheckStatus();
  }

  getVersionCheckDiagnostics() {
    return this.manager.getVersionCheckDiagnostics();
  }

  setUpdateNotificationDisplayHandler(handler) {
    return this.manager.setUpdateNotificationDisplayHandler(handler);
  }

  setUpdateNotificationAckSender(sender) {
    return this.manager.setUpdateNotificationAckSender(sender);
  }

  handleUpdateAvailableEvent(event = {}) {
    return this.manager.handleUpdateAvailableEvent(event);
  }

  getUpdateNotificationStatus() {
    return this.manager.getUpdateNotificationStatus();
  }

  getUpdateNotificationDiagnostics() {
    return this.manager.getUpdateNotificationDiagnostics();
  }

  startDownload(input = {}) {
    return this.manager.startDownload(input);
  }

  pauseDownload(taskId) {
    return this.manager.pauseDownload(taskId);
  }

  resumeDownload(taskId) {
    return this.manager.resumeDownload(taskId);
  }

  cancelDownload(taskId) {
    return this.manager.cancelDownload(taskId);
  }

  removeDownload(taskId) {
    return this.manager.removeDownload(taskId);
  }

  getDownloadStatus(taskId = '') {
    return this.manager.getDownloadStatus(taskId);
  }

  getDownloadDiagnostics() {
    return this.manager.getDownloadDiagnostics();
  }

  verifyPackage(input = {}) {
    return this.manager.verifyPackage(input);
  }

  getVerificationStatus() {
    return this.manager.getVerificationStatus();
  }

  getVerificationDiagnostics() {
    return this.manager.getVerificationDiagnostics();
  }

  install(input = {}) {
    return this.manager.install(input);
  }

  cancelInstallation(reason = 'cancelled') {
    return this.manager.cancelInstallation(reason);
  }

  getInstallationStatus() {
    return this.manager.getInstallationStatus();
  }

  getInstallationDiagnostics() {
    return this.manager.getInstallationDiagnostics();
  }

  selfUpdate(input = {}) {
    return this.manager.selfUpdate(input);
  }

  getSelfUpdateStatus() {
    return this.manager.getSelfUpdateStatus();
  }

  getSelfUpdateDiagnostics() {
    return this.manager.getSelfUpdateDiagnostics();
  }

  getRecoveryStatus() {
    return this.manager.getRecoveryStatus();
  }

  getRecoveryDiagnostics() {
    return this.manager.getRecoveryDiagnostics();
  }

  getRollbackHistory() {
    return this.manager.getRollbackHistory();
  }

  validateStartup(input = {}) {
    return this.manager.validateStartup(input);
  }

  handleStartupFailure(error, context = {}) {
    return this.manager.handleStartupFailure(error, context);
  }

  getPresentation(context = {}) {
    return this.manager.getPresentation(context);
  }

  getReleaseNotes() {
    return this.manager.getReleaseNotes();
  }

  getProgress() {
    return this.manager.getProgress();
  }

  getActions() {
    return this.manager.getActions();
  }

  executePresentationAction(actionId, payload = {}) {
    return this.manager.executePresentationActionFromUi(actionId, payload);
  }

  getPresentationStatus() {
    return this.manager.getPresentationStatus();
  }

  getPresentationDiagnostics() {
    return this.manager.getPresentationDiagnostics();
  }

  assistantUpdateRequest(command = '', source = 'assistant') {
    return this.manager.assistantUpdateRequest(command, source);
  }

  _forwardEvents() {
    const events = require('./UpdateEvents');
    for (const eventName of Object.values(events)) {
      this.manager.on(eventName, payload => this.emit(eventName, payload));
    }
    const { InstallationEvents } = require('./install');
    for (const eventName of Object.values(InstallationEvents)) {
      this.manager.on(eventName, payload => this.emit(eventName, payload));
    }
    const { SelfUpdateEvents } = require('./selfupdate');
    for (const eventName of Object.values(SelfUpdateEvents)) {
      this.manager.on(eventName, payload => this.emit(eventName, payload));
    }
    const { RecoveryEvents } = require('./recovery');
    for (const eventName of Object.values(RecoveryEvents)) {
      this.manager.on(eventName, payload => this.emit(eventName, payload));
    }
  }
}

module.exports = UpdateEngine;
