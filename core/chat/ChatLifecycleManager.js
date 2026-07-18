const CHAT_EVENTS = require('./ChatEvents');

/**
 * Coordinates Desktop Chat lifecycle events.
 */
class ChatLifecycleManager {
  /**
   * Creates a lifecycle manager.
   * @param {object} options Lifecycle dependencies.
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.statusManager = options.statusManager;
    this.started = false;
  }

  /**
   * Starts lifecycle state.
   */
  start() {
    if (this.started) return;
    this.statusManager.setState('starting');
    this.eventBus.emit(CHAT_EVENTS.LIFECYCLE_STARTING);
    this.started = true;
    this.statusManager.setState('offline');
    this.eventBus.emit(CHAT_EVENTS.LIFECYCLE_STARTED);
  }

  /**
   * Stops lifecycle state.
   */
  stop() {
    if (!this.started) return;
    this.statusManager.setState('stopping');
    this.eventBus.emit(CHAT_EVENTS.LIFECYCLE_STOPPING);
    this.started = false;
    this.statusManager.setState('offline');
    this.eventBus.emit(CHAT_EVENTS.LIFECYCLE_STOPPED);
  }
}

module.exports = ChatLifecycleManager;
