const EventEmitter = require('events');
const InstallationManager = require('./InstallationManager');

class InstallationEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.manager = options.manager || new InstallationManager(options);
    this._forwardEvents();
  }

  initialize(directories) {
    return this.manager.initialize(directories);
  }

  install(input = {}) {
    return this.manager.install(input);
  }

  cancel(reason = 'cancelled') {
    return this.manager.cancel(reason);
  }

  shutdown() {
    return this.manager.shutdown();
  }

  getStatus() {
    return this.manager.getStatus();
  }

  getDiagnostics() {
    return this.manager.getDiagnostics();
  }

  _forwardEvents() {
    const events = require('./InstallationEvents');
    for (const eventName of Object.values(events)) {
      this.manager.on(eventName, payload => this.emit(eventName, payload));
    }
  }
}

module.exports = InstallationEngine;
