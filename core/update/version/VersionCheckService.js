const EventEmitter = require('events');
const VersionCheckManager = require('./VersionCheckManager');

class VersionCheckService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.manager = options.manager || new VersionCheckManager(options);
    this.initialized = false;
    this._forwardEvents();
  }

  initialize() {
    const result = this.manager.initialize();
    this.initialized = result.success === true;
    return result;
  }

  checkNow(options = {}) {
    if (!this.initialized) this.initialize();
    return this.manager.checkNow(options);
  }

  checkOnStartup(options = {}) {
    if (!this.initialized) this.initialize();
    return this.manager.checkOnStartup(options);
  }

  shutdown() {
    return this.manager.shutdown();
  }

  getLatestResult() {
    return this.manager.getLatestResult();
  }

  getStatus() {
    return this.manager.getStatus();
  }

  getDiagnostics() {
    return this.manager.getDiagnostics();
  }

  isUpdateAvailable() {
    return this.manager.isUpdateAvailable();
  }

  getCurrentVersion() {
    return this.manager.getCurrentVersion();
  }

  getLatestVersion() {
    return this.manager.getLatestVersion();
  }

  setRelayClient(clientOrProvider) {
    return this.manager.setRelayClient(clientOrProvider);
  }

  _forwardEvents() {
    const events = require('./VersionCheckEvents');
    for (const eventName of Object.values(events)) {
      this.manager.on(eventName, payload => this.emit(eventName, payload));
    }
  }
}

module.exports = VersionCheckService;
