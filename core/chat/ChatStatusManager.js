/**
 * Tracks Desktop Chat connection and lifecycle status.
 */
class ChatStatusManager {
  /**
   * Creates a status manager.
   */
  constructor() {
    this.state = 'offline';
    this.lastChangedAt = new Date().toISOString();
    this.lastError = null;
  }

  /**
   * Updates the chat status.
   * @param {string} state New state.
   * @param {object} details State details.
   */
  setState(state, details = {}) {
    this.state = String(state || 'offline');
    this.lastChangedAt = new Date().toISOString();
    this.lastError = details.error || null;
  }

  /**
   * Returns a status snapshot.
   * @returns {object} Status snapshot.
   */
  getStatus() {
    return Object.freeze({
      state: this.state,
      lastChangedAt: this.lastChangedAt,
      lastError: this.lastError
    });
  }
}

module.exports = ChatStatusManager;
