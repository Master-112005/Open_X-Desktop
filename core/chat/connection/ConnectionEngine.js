const ConnectionConfiguration = require('./ConnectionConfiguration');
const ConnectionEvents = require('./ConnectionEvents');
const ConnectionLogger = require('./ConnectionLogger');
const PresenceManager = require('./PresenceManager');
const HeartbeatManager = require('./HeartbeatManager');
const NetworkMonitor = require('./NetworkMonitor');
const SessionManager = require('./SessionManager');
const RecoveryManager = require('./RecoveryManager');

/**
 * Desktop Phase 11 connection and presence engine.
 */
class ConnectionEngine {
  /** @param {object} options Engine options. */
  constructor(options = {}) {
    this.config = options.config instanceof ConnectionConfiguration ? options.config : new ConnectionConfiguration(options.config || {});
    this.connectionManager = options.connectionManager;
    this.synchronizationManager = options.synchronizationManager;
    this.eventBus = options.eventBus;
    this.logger = options.logger || new ConnectionLogger();
    this.presenceManager = options.presenceManager || new PresenceManager({ eventBus: this.eventBus, events: ConnectionEvents });
    this.heartbeatManager = options.heartbeatManager || new HeartbeatManager({ connectionManager: this.connectionManager, eventBus: this.eventBus, events: ConnectionEvents });
    this.networkMonitor = options.networkMonitor || new NetworkMonitor({ provider: options.networkProvider });
    this.sessionManager = options.sessionManager || new SessionManager();
    this.recoveryManager = options.recoveryManager || new RecoveryManager({
      connectionManager: this.connectionManager,
      synchronizationManager: this.synchronizationManager,
      networkMonitor: this.networkMonitor,
      eventBus: this.eventBus,
      events: ConnectionEvents
    });
  }

  /** @param {object} input Connect input. @returns {Promise<object>} Status. */
  async connect(input = {}) {
    const status = await this.connectionManager.connect();
    if (input.accountId && input.deviceId) {
      this.connectionManager.sendInfrastructureEvent('connection:identify', {
        accountId: input.accountId,
        deviceId: input.deviceId,
        platform: input.platform || this.config.platform
      });
    }
    this.presenceManager.setPresence({ accountId: input.accountId, deviceId: input.deviceId, state: 'Online', source: 'desktop-connect' });
    this.eventBus?.emit?.(ConnectionEvents.CONNECTED, { deviceId: input.deviceId });
    if (this.config.syncOnConnect && input.deviceId && this.synchronizationManager) {
      this.eventBus?.emit?.(ConnectionEvents.SYNCHRONIZATION_REQUIRED, { deviceId: input.deviceId });
      await this.synchronizationManager.synchronize({ deviceId: input.deviceId, afterSequence: input.afterSequence || 0, limit: input.limit });
      this.eventBus?.emit?.(ConnectionEvents.SYNCHRONIZATION_COMPLETED, { deviceId: input.deviceId });
    }
    return status;
  }

  /** @param {object} session Session payload. @returns {object} Session. */
  acceptSession(session = {}) {
    return this.sessionManager.setSession(session);
  }

  /** Disconnects the persistent desktop socket. */
  disconnect() {
    this.connectionManager.disconnect();
    this.sessionManager.clear();
    this.presenceManager.setPresence({ state: 'Offline', source: 'desktop-disconnect' });
    this.eventBus?.emit?.(ConnectionEvents.DISCONNECTED, {});
  }

  /** @param {object} input Wake input. @returns {Promise<object>} Recovery result. */
  async wake(input = {}) {
    this.eventBus?.emit?.(ConnectionEvents.WAKE, { deviceId: input.deviceId });
    return this.recoveryManager.recover({ ...input, reason: input.reason || 'wake' });
  }

  /** @param {object} input Recovery input. @returns {Promise<object>} Recovery result. */
  recover(input = {}) {
    return this.recoveryManager.recover(input);
  }

  /** @returns {object} Connection status. */
  getStatus() {
    return {
      connection: this.connectionManager.getStatus(),
      presence: this.presenceManager.getPresence(),
      session: this.sessionManager.getSession(),
      heartbeat: this.heartbeatManager.status(),
      network: this.networkMonitor.getStatus()
    };
  }
}

ConnectionEngine.Events = ConnectionEvents;

module.exports = ConnectionEngine;
