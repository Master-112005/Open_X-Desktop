const ChatRuntimeStateMachine = require('./state/ChatRuntimeStateMachine');

/**
 * Tracks Desktop Chat connection and lifecycle status.
 */
class ChatStatusManager {
  /**
   * Creates a status manager.
   */
  constructor() {
    this.stateMachine = new ChatRuntimeStateMachine();
  }

  /**
   * Updates the chat status.
   * @param {string} state New state.
   * @param {object} details State details.
   */
  setState(state, details = {}) {
    return this.stateMachine.setState(state, details);
  }

  /**
   * Updates status from authoritative setup facts.
   * @param {object} context Setup lifecycle context.
   * @returns {object} Status snapshot.
   */
  setContext(context = {}) {
    return this.stateMachine.applyContext(context);
  }

  /**
   * Returns a status snapshot.
   * @returns {object} Status snapshot.
   */
  getStatus() {
    return this.stateMachine.getSnapshot();
  }
}

module.exports = ChatStatusManager;
