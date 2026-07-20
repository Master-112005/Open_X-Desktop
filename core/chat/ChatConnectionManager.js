const WebSocket = require('ws');
const CHAT_EVENTS = require('./ChatEvents');

/**
 * Desktop Chat WebSocket wrapper with reconnect and heartbeat infrastructure.
 */
class ChatConnectionManager {
  /**
   * Creates a Desktop Chat connection manager.
   * @param {object} options Connection dependencies.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.logger = options.logger;
    this.eventBus = options.eventBus;
    this.statusManager = options.statusManager;
    this.socket = null;
    this.state = 'offline';
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.connectionTimeout = null;
    this.lastConnectedAt = null;
    this.lastDisconnectedAt = null;
    this.lastPongAt = null;
    this.manualDisconnect = true;
  }

  /**
   * Starts a connection to the future Chat Server.
   * @returns {Promise<object>} Connection status.
   */
  connect() {
    this.manualDisconnect = false;
    this.clearReconnectTimer();
    this.setState('connecting');
    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (error, value) => {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve(value);
      };
      try {
        this.socket = new WebSocket(this.config.serverUrl);
      } catch (error) {
        this.handleConnectionFailure(error);
        settle(error);
        return;
      }
      this.connectionTimeout = setTimeout(() => {
        const error = new Error('Desktop Chat connection timed out.');
        this.handleConnectionFailure(error);
        settle(error);
      }, this.config.connectionTimeoutMs);
      this.connectionTimeout.unref?.();
      this.socket.on('open', () => {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
        this.lastConnectedAt = new Date().toISOString();
        this.reconnectAttempts = 0;
        this.setState('connected');
        this.startHeartbeat();
        this.sendInfrastructureEvent('connection:ready', { protocolVersion: this.config.protocolVersion });
        settle(null, this.getStatus());
      });
      this.socket.on('message', data => this.handleMessage(data));
      this.socket.on('close', () => this.handleClose());
      this.socket.on('error', error => this.handleConnectionFailure(error));
      this.socket.on('pong', () => {
        this.lastPongAt = new Date().toISOString();
        this.eventBus.emit(CHAT_EVENTS.CONNECTION_HEARTBEAT, { lastPongAt: this.lastPongAt });
      });
    });
  }

  /**
   * Disconnects from the Chat Server.
   */
  disconnect() {
    this.manualDisconnect = true;
    this.clearReconnectTimer();
    this.clearConnectionTimeout();
    this.stopHeartbeat();
    if (this.socket) this.socket.close(1000, 'desktop-chat-disconnect');
    this.socket = null;
    this.setState('disconnected');
  }

  /**
   * Sends an infrastructure-only event.
   * @param {string} type Event type.
   * @param {object} data Event data.
   * @returns {boolean} Whether the event was sent.
   */
  sendInfrastructureEvent(type, data = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    if (/^(chat|message|contact|account|otp|notification|encryption):/i.test(type)) {
      throw new Error('Future chat business events are disabled in Phase 1.');
    }
    this.socket.send(JSON.stringify({ type, data, timestamp: new Date().toISOString() }));
    return true;
  }

  /**
   * Sends a Phase 8 messaging event.
   * @param {string} type Event type.
   * @param {object} data Event data.
   * @returns {boolean} Whether the event was sent.
   */
  sendMessageEvent(type, data = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    if (!/^(message|typing):/i.test(type)) throw new Error('Only Phase 8 message events can use sendMessageEvent.');
    this.socket.send(JSON.stringify({ type, data, timestamp: new Date().toISOString() }));
    return true;
  }

  /**
   * Handles an inbound server message.
   * @param {Buffer|string} data Raw message data.
   */
  handleMessage(data) {
    try {
      const payload = JSON.parse(data.toString());
      if (payload.type === 'pong') {
        this.lastPongAt = new Date().toISOString();
        return;
      }
      if (payload.type === 'connection:ready:ack') this.setState('connected');
      if (payload.type === 'connection:identified') this.setState('ready');
      if (/^connection:/i.test(payload.type)) this.eventBus.emit(payload.type, payload.data || {});
      if (/^(message|typing):/i.test(payload.type)) this.eventBus.emit(payload.type, payload.data || {});
    } catch (error) {
      this.logger.warn('Desktop Chat ignored malformed server message', { error: error.message });
    }
  }

  /**
   * Handles socket close.
   */
  handleClose() {
    this.clearConnectionTimeout();
    this.stopHeartbeat();
    this.lastDisconnectedAt = new Date().toISOString();
    this.setState('disconnected');
    if (!this.manualDisconnect) this.scheduleReconnect();
  }

  /**
   * Handles socket errors and schedules reconnect when appropriate.
   * @param {Error} error Socket error.
   */
  handleConnectionFailure(error) {
    this.clearConnectionTimeout();
    this.logger.warn('Desktop Chat connection error', { error: error.message });
    this.eventBus.emit(CHAT_EVENTS.CONNECTION_ERROR, { error: error.message });
    this.setState('offline', { error: error.message });
    if (!this.manualDisconnect) this.scheduleReconnect();
  }

  /**
   * Schedules reconnect using bounded exponential backoff.
   */
  scheduleReconnect() {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) return;
    this.reconnectAttempts += 1;
    const delay = Math.min(
      this.config.reconnectMaxDelayMs,
      this.config.reconnectMinDelayMs * (2 ** Math.max(0, this.reconnectAttempts - 1))
    );
    this.setState('reconnecting');
    this.eventBus.emit(CHAT_EVENTS.CONNECTION_RECONNECTING, { reconnectAttempts: this.reconnectAttempts, delay });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {});
    }, delay);
    this.reconnectTimer.unref?.();
  }

  /**
   * Starts heartbeat pings.
   */
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.sendInfrastructureEvent('ping', { client: 'desktop' })) this.handleClose();
    }, this.config.heartbeatIntervalMs);
    this.heartbeatTimer.unref?.();
  }

  /**
   * Stops heartbeat pings.
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  /**
   * Clears pending reconnect timer.
   */
  clearReconnectTimer() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  /**
   * Clears a pending socket connection timeout.
   */
  clearConnectionTimeout() {
    if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
    this.connectionTimeout = null;
  }

  /**
   * Updates connection state.
   * @param {string} state New state.
   * @param {object} details State details.
   */
  setState(state, details = {}) {
    this.state = state;
    this.statusManager.setState(state, details);
    const eventMap = {
      connecting: CHAT_EVENTS.CONNECTION_CONNECTING,
      connected: CHAT_EVENTS.CONNECTION_CONNECTED,
      ready: CHAT_EVENTS.CONNECTION_READY,
      disconnected: CHAT_EVENTS.CONNECTION_DISCONNECTED,
      offline: CHAT_EVENTS.CONNECTION_DISCONNECTED,
      reconnecting: CHAT_EVENTS.CONNECTION_RECONNECTING
    };
    if (eventMap[state]) this.eventBus.emit(eventMap[state], { state, ...details });
  }

  /**
   * Returns a public connection status snapshot.
   * @returns {object} Connection status.
   */
  getStatus() {
    return Object.freeze({
      state: this.state,
      reconnectAttempts: this.reconnectAttempts,
      lastConnectedAt: this.lastConnectedAt,
      lastDisconnectedAt: this.lastDisconnectedAt,
      lastPongAt: this.lastPongAt,
      serverUrl: this.config.serverUrl
    });
  }
}

module.exports = ChatConnectionManager;
