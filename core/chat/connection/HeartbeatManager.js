/**
 * Desktop heartbeat facade around the existing WebSocket manager.
 */
class HeartbeatManager {
  /** @param {object} options Options. */
  constructor(options = {}) {
    this.connectionManager = options.connectionManager;
    this.eventBus = options.eventBus;
    this.events = options.events;
  }

  /** Starts heartbeat. */
  start() {
    this.connectionManager?.startHeartbeat?.();
  }

  /** Stops heartbeat. */
  stop() {
    this.connectionManager?.stopHeartbeat?.();
  }

  /** @returns {object} Heartbeat status. */
  status() {
    return {
      lastPongAt: this.connectionManager?.lastPongAt || null,
      state: this.connectionManager?.state || 'offline'
    };
  }
}

module.exports = HeartbeatManager;
