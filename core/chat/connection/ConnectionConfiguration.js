/**
 * Desktop Phase 11 connection engine configuration.
 */
class ConnectionConfiguration {
  /** @param {object} options Configuration overrides. */
  constructor(options = {}) {
    this.heartbeatIntervalMs = this.number(options.heartbeatIntervalMs, 30000);
    this.heartbeatTimeoutMs = this.number(options.heartbeatTimeoutMs, 10000);
    this.reconnectMinDelayMs = this.number(options.reconnectMinDelayMs, 1000);
    this.reconnectMaxDelayMs = this.number(options.reconnectMaxDelayMs, 30000);
    this.presenceTimeoutMs = this.number(options.presenceTimeoutMs, 120000);
    this.sessionTimeoutMs = this.number(options.sessionTimeoutMs, 3600000);
    this.synchronizationIntervalMs = this.number(options.synchronizationIntervalMs, 30000);
    this.persistentSocket = options.persistentSocket !== false;
    this.syncOnConnect = options.syncOnConnect !== false;
    this.platform = options.platform || 'windows';
    this.validate();
    Object.freeze(this);
  }

  /** @param {*} value Value. @param {number} fallback Fallback. @returns {number} Number. */
  number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  /** Validates configuration. */
  validate() {
    if (this.heartbeatIntervalMs < 1000) throw new Error('Connection heartbeat interval is too small.');
    if (this.heartbeatTimeoutMs < 1000) throw new Error('Connection heartbeat timeout is too small.');
    if (this.reconnectMaxDelayMs < this.reconnectMinDelayMs) throw new Error('Connection reconnect max delay must be >= min delay.');
    if (this.presenceTimeoutMs < this.heartbeatIntervalMs) throw new Error('Connection presence timeout must be >= heartbeat interval.');
  }
}

module.exports = ConnectionConfiguration;
