/**
 * Centralized Desktop Chat configuration.
 */
class ChatConfiguration {
  /**
   * Creates a Desktop Chat configuration.
   * @param {object} options Configuration overrides.
   */
  constructor(options = {}) {
    this.serverUrl = String(options.serverUrl || process.env.OPENX_CHAT_SERVER_URL || 'wss://openx-chat-server.onrender.com/ws').trim();
    this.dataPaths = options.dataPaths || null;
    this.dataRoot = options.dataRoot || null;
    this.protocolVersion = String(options.protocolVersion || '1');
    this.heartbeatIntervalMs = this.number(options.heartbeatIntervalMs, 30000);
    this.heartbeatTimeoutMs = this.number(options.heartbeatTimeoutMs, 10000);
    this.connectionTimeoutMs = this.number(options.connectionTimeoutMs, 15000);
    this.reconnectMinDelayMs = this.number(options.reconnectMinDelayMs, 1000);
    this.reconnectMaxDelayMs = this.number(options.reconnectMaxDelayMs, 30000);
    this.maxReconnectAttempts = this.number(options.maxReconnectAttempts, Infinity);
    this.maxPayloadBytes = this.number(options.maxPayloadBytes, 32768);
    this.featureFlags = Object.freeze({
      authentication: false,
      encryption: false,
      messaging: true,
      notifications: false,
      synchronization: true,
      historySynchronization: true,
      multiDevice: true,
      connectionEngine: true,
      backgroundRecovery: true,
      pushWake: false,
      fileTransfer: true,
      conversations: true,
      securityPlatform: true,
      infrastructureOptimization: true,
      productionReadiness: true,
      ...(options.featureFlags || {})
    });
    this.optimization = Object.freeze({
      maxMetricSamples: this.number(options.optimization?.maxMetricSamples, 500),
      slowOperationMs: this.number(options.optimization?.slowOperationMs, 700),
      maxLocalRecords: this.number(options.optimization?.maxLocalRecords, 10000),
      heapWarningBytes: this.number(options.optimization?.heapWarningBytes, 268435456),
      defaultSyncBatchSize: this.number(options.optimization?.defaultSyncBatchSize, 50),
      maxSyncBatchSize: this.number(options.optimization?.maxSyncBatchSize, 200),
      maxReleaseLogEntries: this.number(options.optimization?.maxReleaseLogEntries, 100)
    });
    this.validate();
    Object.freeze(this);
  }

  /**
   * Converts a value to a finite number.
   * @param {*} value Candidate value.
   * @param {number} fallback Fallback value.
   * @returns {number} Parsed number.
   */
  number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  /**
   * Validates configuration values.
   */
  validate() {
    if (!/^wss?:\/\//i.test(this.serverUrl)) throw new Error('Chat server URL must be ws:// or wss://.');
    if (this.heartbeatIntervalMs < 1000) throw new Error('Chat heartbeat interval is too small.');
    if (this.heartbeatTimeoutMs < 1000) throw new Error('Chat heartbeat timeout is too small.');
    if (this.connectionTimeoutMs < 1000) throw new Error('Chat connection timeout is too small.');
    if (this.reconnectMaxDelayMs < this.reconnectMinDelayMs) throw new Error('Chat reconnect max delay must be >= min delay.');
  }

  /**
   * Returns a public configuration snapshot.
   * @returns {object} Configuration snapshot.
   */
  toJSON() {
    return {
      serverUrl: this.serverUrl,
      protocolVersion: this.protocolVersion,
      heartbeatIntervalMs: this.heartbeatIntervalMs,
      heartbeatTimeoutMs: this.heartbeatTimeoutMs,
      connectionTimeoutMs: this.connectionTimeoutMs,
      reconnectMinDelayMs: this.reconnectMinDelayMs,
      reconnectMaxDelayMs: this.reconnectMaxDelayMs,
      maxReconnectAttempts: this.maxReconnectAttempts,
      maxPayloadBytes: this.maxPayloadBytes,
      dataRoot: this.dataRoot,
      optimization: this.optimization,
      featureFlags: this.featureFlags
    };
  }
}

module.exports = ChatConfiguration;
