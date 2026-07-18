/**
 * Builds Desktop Chat health snapshots.
 */
class ChatHealthManager {
  /**
   * Creates a health manager.
   * @param {object} options Health dependencies.
   */
  constructor(options = {}) {
    this.statusManager = options.statusManager;
    this.connectionManager = options.connectionManager;
    this.versionManager = options.versionManager;
  }

  /**
   * Returns current health state.
   * @returns {object} Health snapshot.
   */
  getHealth() {
    return Object.freeze({
      status: this.statusManager.getStatus(),
      connection: this.connectionManager?.getStatus?.() || null,
      version: this.versionManager.getVersion(),
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = ChatHealthManager;
