/**
 * Provides Desktop Chat protocol and module version metadata.
 */
class ChatVersionManager {
  /**
   * Creates a version manager.
   * @param {object} options Version options.
   */
  constructor(options = {}) {
    this.moduleVersion = String(options.moduleVersion || '0.1.0');
    this.protocolVersion = String(options.protocolVersion || '1');
  }

  /**
   * Returns version metadata.
   * @returns {object} Version snapshot.
   */
  getVersion() {
    return Object.freeze({
      moduleVersion: this.moduleVersion,
      protocolVersion: this.protocolVersion
    });
  }
}

module.exports = ChatVersionManager;
