const EventEmitter = require('events');
const SelfUpdateManager = require('./SelfUpdateManager');
const EVENTS = require('./SelfUpdateEvents');

class SelfUpdateEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.manager = options.manager || new SelfUpdateManager(options);
    for (const eventName of Object.values(EVENTS)) {
      this.manager.on(eventName, payload => this.emit(eventName, payload));
    }
  }

  initialize(directories) {
    return this.manager.initialize(directories);
  }

  selfUpdate(input = {}) {
    return this.manager.selfUpdate(input);
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
}

module.exports = SelfUpdateEngine;
