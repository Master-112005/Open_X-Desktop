/**
 * Desktop Chat service facade. Phase 1 exposes infrastructure only.
 */
class ChatService {
  /**
   * Creates a Desktop Chat service.
   * @param {object} options Service dependencies.
   */
  constructor(options = {}) {
    this.connectionManager = options.connectionManager;
    this.healthManager = options.healthManager;
    this.versionManager = options.versionManager;
  }

  /**
   * Connects the Desktop Chat infrastructure.
   * @returns {Promise<object>} Connection status.
   */
  connect() {
    return this.connectionManager.connect();
  }

  /**
   * Disconnects the Desktop Chat infrastructure.
   */
  disconnect() {
    this.connectionManager.disconnect();
  }

  /**
   * Returns health information.
   * @returns {object} Health snapshot.
   */
  getHealth() {
    return this.healthManager.getHealth();
  }

  /**
   * Returns version information.
   * @returns {object} Version snapshot.
   */
  getVersion() {
    return this.versionManager.getVersion();
  }
}

module.exports = ChatService;
