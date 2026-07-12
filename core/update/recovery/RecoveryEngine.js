const EventEmitter = require('events');
const RecoveryManager = require('./RecoveryManager');
const EVENTS = require('./RecoveryEvents');

class RecoveryEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.manager = options.manager || new RecoveryManager(options);
    for (const eventName of Object.values(EVENTS)) {
      this.manager.on(eventName, payload => this.emit(eventName, payload));
    }
  }

  initialize(directories) { return this.manager.initialize(directories); }
  updateConfiguration(configuration) { return this.manager.updateConfiguration(configuration); }
  createBackupForUpdate(input) { return this.manager.createBackupForUpdate(input); }
  markInstalling(input) { return this.manager.markInstalling(input); }
  markStartupValidationPending(input) { return this.manager.markStartupValidationPending(input); }
  validateStartup(input) { return this.manager.validateStartup(input); }
  handleInstallationFailure(error, context) { return this.manager.handleInstallationFailure(error, context); }
  handleStartupFailure(error, context) { return this.manager.handleStartupFailure(error, context); }
  recover(error, context) { return this.manager.recover(error, context); }
  getStatus() { return this.manager.getStatus(); }
  getDiagnostics() { return this.manager.getDiagnostics(); }
  getRollbackHistory() { return this.manager.getRollbackHistory(); }
  shutdown() { return this.manager.shutdown(); }
}

module.exports = RecoveryEngine;
