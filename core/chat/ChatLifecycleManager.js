const CHAT_EVENTS = require('./ChatEvents');
const ChatRuntimeStateMachine = require('./state/ChatRuntimeStateMachine');

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
    this.statusManager.setState(ChatRuntimeStateMachine.STATES.UNINITIALIZED, { lifecycle: 'starting' });
    this.eventBus.emit(CHAT_EVENTS.LIFECYCLE_STARTING);
    this.started = true;
    this.statusManager.setState(ChatRuntimeStateMachine.STATES.UNINITIALIZED, { lifecycle: 'started' });
    this.eventBus.emit(CHAT_EVENTS.LIFECYCLE_STARTED);
  }

  /**
   * Stops lifecycle state.
   */
  stop() {
    if (!this.started) return;
    this.statusManager.setState(ChatRuntimeStateMachine.STATES.UNINITIALIZED, { lifecycle: 'stopping' });
    this.eventBus.emit(CHAT_EVENTS.LIFECYCLE_STOPPING);
    this.started = false;
    this.statusManager.setState(ChatRuntimeStateMachine.STATES.UNINITIALIZED, { lifecycle: 'stopped' });
    this.eventBus.emit(CHAT_EVENTS.LIFECYCLE_STOPPED);
  }
}

module.exports = ChatLifecycleManager;
