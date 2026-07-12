const EventEmitter = require('events');
const { WebSocket } = require('ws');
const { SecurePacketChannel } = require('./CloudE2EE');

const STATES = Object.freeze({
  DISCONNECTED: 'Disconnected',
  CONNECTING: 'Connecting',
  CONNECTED: 'Connected',
  RECONNECTING: 'Reconnecting',
  DISCONNECTING: 'Disconnecting',
  ERROR: 'Error'
});

const DEFAULT_RECONNECT_DELAYS = Object.freeze([1000, 2000, 5000, 10000, 20000, 30000]);
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_HEARTBEAT_MS = 30000;
const DEFAULT_RELAY_URL = 'wss://openx-server.onrender.com/ws';
const LEGACY_DEFAULT_RELAY_URLS = new Set(['ws://localhost:8081/ws']);

function nowIso() {
  return new Date().toISOString();
}

function decodeBase64UrlJson(value) {
  try {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch (_) {
    return null;
  }
}

function readAccessTokenDeviceId(auth) {
  const token = String(auth?.accessToken || '').trim();
  const parts = token.split('.');
  if (parts.length !== 3) return '';
  const claims = decodeBase64UrlJson(parts[1]);
  return String(claims?.deviceId || '').trim();
}

function normalizeRelayUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) throw new Error('Relay URL is required');
  let parsed;
  try {
    parsed = new URL(raw);
  } catch (_) {
    throw new Error('Relay URL is invalid');
  }

  if (!['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol)) {
    throw new Error('Relay URL must use http, https, ws, or wss');
  }

  if (parsed.protocol === 'http:') parsed.protocol = 'ws:';
  if (parsed.protocol === 'https:') parsed.protocol = 'wss:';
  if (!parsed.pathname || parsed.pathname === '/') parsed.pathname = '/ws';
  parsed.hash = '';
  const normalized = parsed.toString();
  return LEGACY_DEFAULT_RELAY_URLS.has(normalized) ? DEFAULT_RELAY_URL : normalized;
}

function socketIsOpen(socket) {
  return Boolean(socket && socket.readyState === WebSocket.OPEN);
}

function withReconnectJitter(delayMs) {
  const jitter = delayMs * 0.2 * (Math.random() * 2 - 1);
  return Math.max(250, Math.round(delayMs + jitter));
}

class CloudConnectionManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.WebSocketImpl = options.WebSocketImpl || WebSocket;
    this.logger = options.logger || console;
    this.now = options.now || (() => Date.now());
    this.version = String(options.version || '0.0.0');
    this.secureChannel = options.secureChannel || new SecurePacketChannel({
      masterKey: options.e2eeMasterKey || '',
      logger: this.logger,
      now: this.now
    });

    this.socket = null;
    this.state = STATES.DISCONNECTED;
    this.userDisconnected = true;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.connectionTimer = null;
    this.heartbeatTimer = null;
    this.connectedAt = null;
    this.lastConnectedAt = null;
    this.lastDisconnectedAt = null;
    this.lastError = '';
    this.latencyMs = null;
    this.pendingPingAt = 0;
    this.clientId = '';
    this.serverVersion = '';
    this.relayUrl = '';
    this.pendingRequests = new Map();
    this.device = null;
    this.owner = null;
    this.pairedDevices = [];
    this.presence = [];
    this.notifications = [];
    this.auth = null;
    this.reliability = {
      state: 'offline',
      reconnectCount: 0,
      droppedConnections: 0,
      sessionRestoreCount: 0,
      retryCount: 0,
      lastRecoveryAt: null
    };
    this.settings = this.normalizeSettings(options.settings || {});
  }

  normalizeSettings(settings = {}) {
    const source = settings && typeof settings === 'object' ? settings : {};
    return {
      enabled: source.enabled === true,
      deviceId: String(source.deviceId || '').trim(),
      ownerId: String(source.ownerId || '').trim(),
      deviceType: String(source.deviceType || 'desktop').trim() || 'desktop',
      friendlyName: String(source.friendlyName || 'OpenX Desktop').trim() || 'OpenX Desktop',
      relayUrl: String(source.relayUrl || process.env.OPENX_RELAY_URL || '').trim() || DEFAULT_RELAY_URL,
      autoConnect: source.autoConnect === true,
      reconnectEnabled: source.reconnectEnabled !== false,
      heartbeatEnabled: source.heartbeatEnabled !== false,
      connectionTimeoutMs: this.clamp(source.connectionTimeoutMs, 1000, 60000, DEFAULT_TIMEOUT_MS),
      heartbeatIntervalMs: this.clamp(source.heartbeatIntervalMs, 5000, 120000, DEFAULT_HEARTBEAT_MS)
    };
  }

  clamp(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, Math.round(number)));
  }

  updateSettings(settings = {}) {
    this.settings = this.normalizeSettings({ ...this.settings, ...settings });
    if (this.state === STATES.CONNECTED) {
      this.relayUrl = this.getWebSocketUrl(this.settings.relayUrl);
      this.restartHeartbeat();
    }
    return this.getStatus();
  }

  async connect(settings = {}) {
    this.settings = this.normalizeSettings({ ...this.settings, ...settings });
    this.relayUrl = this.getWebSocketUrl(this.settings.relayUrl);
    this.userDisconnected = false;
    this.clearReconnectTimer();

    if ([STATES.CONNECTING, STATES.RECONNECTING].includes(this.state)) {
      return this.getStatus();
    }
    if (this.isConnected()) {
      return this.getStatus();
    }

    return this.openSocket(STATES.CONNECTING);
  }

  async disconnect(reason = 'manual-disconnect') {
    this.userDisconnected = true;
    this.clearReconnectTimer();
    this.clearConnectionTimer();
    this.stopHeartbeat();

    if (!this.socket) {
      this.setState(STATES.DISCONNECTED, { reason });
      return this.getStatus();
    }

    this.setState(STATES.DISCONNECTING, { reason });
    const socket = this.socket;
    this.socket = null;
    await this.closeSocket(socket, 1000, reason);
    this.clientId = '';
    this.serverVersion = '';
    this.device = null;
    this.owner = null;
    this.presence = [];
    this.notifications = [];
    this.auth = null;
    this.connectedAt = null;
    this.rejectPendingRequests(new Error('Cloud connection disconnected.'));
    this.lastDisconnectedAt = nowIso();
    this.setState(STATES.DISCONNECTED, { reason });
    this.logger.info('Disconnected', { reason });
    return this.getStatus();
  }

  async reconnect(reason = 'manual-reconnect') {
    this.userDisconnected = false;
    this.clearReconnectTimer();
    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      await this.closeSocket(socket, 1000, reason);
    }
    this.reconnectAttempts += 1;
    return this.openSocket(STATES.RECONNECTING);
  }

  isConnected() {
    return socketIsOpen(this.socket) && this.state === STATES.CONNECTED;
  }

  getLatency() {
    return Number.isFinite(this.latencyMs) ? this.latencyMs : null;
  }

  send(payload) {
    if (!this.isConnected()) return false;
    try {
      const envelope = this.withAuth(payload || {});
      this.socket.send(JSON.stringify(envelope));
      return true;
    } catch (error) {
      this.logger.warn('Send failed', { error: error.message });
      return false;
    }
  }

  sendRelayPacket(packet) {
    const protectedPacket = this.protectRelayPacket(packet);
    const sent = this.send({
      type: 'relay:packet',
      packet: protectedPacket
    });
    if (!sent && packet?.metadata?.retryable === true) {
      this.reliability.retryCount += 1;
      this.emitStatus({ reliability: this.getReliabilityStatus('recovering') });
    }
    return sent;
  }

  requestPairToken(options = {}) {
    if (!this.isConnected()) {
      return Promise.reject(new Error('Connect to Relay Server first.'));
    }
    const requestId = `cloud-pair-token-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const timeoutMs = this.clamp(options.timeoutMs, 1000, 30000, 10000);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Cloud pair token request timed out.'));
      }, timeoutMs);
      timeout.unref?.();
      this.pendingRequests.set(requestId, { resolve, reject, timeout });
      const sent = this.send({
        type: 'cloud-pair-token:create',
        requestId,
        ttlMs: this.clamp(options.ttlMs, 30000, 900000, 5 * 60 * 1000)
      });
      if (!sent) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(new Error('Cloud relay is not connected.'));
      }
    });
  }

  approvePairingRequest(pairRequestId, security = null) {
    return this.send({
      type: 'cloud-pair:approve',
      pairRequestId,
      ...(security ? { security } : {})
    });
  }

  rejectPairingRequest(pairRequestId) {
    return this.send({
      type: 'cloud-pair:reject',
      pairRequestId
    });
  }

  updateDevice(deviceId, updates = {}) {
    return this.sendDeviceMutation('device:update', {
      deviceId,
      ...updates
    });
  }

  removeDevice(deviceId) {
    return this.sendDeviceMutation('device:remove', { deviceId });
  }

  listDevices(options = {}) {
    return this.sendDeviceMutation('device:list', {}, options);
  }

  updatePresence(state, metadata = {}) {
    return this.send({
      type: 'presence:update',
      requestId: `presence-${Date.now()}`,
      state,
      metadata,
      activity: true
    });
  }

  subscribePresence() {
    return this.send({
      type: 'presence:subscribe',
      requestId: `presence-subscribe-${Date.now()}`
    });
  }

  requestPresenceList() {
    return this.send({
      type: 'presence:list',
      requestId: `presence-list-${Date.now()}`
    });
  }

  createNotification(payload = {}) {
    return this.send({
      ...payload,
      type: 'notification:create',
      requestId: payload.requestId || `notification-create-${Date.now()}`
    });
  }

  requestNotificationList() {
    return this.send({
      type: 'notification:list',
      requestId: `notification-list-${Date.now()}`
    });
  }

  requestVersionCheck(request = {}, options = {}) {
    if (!this.isConnected()) {
      return Promise.reject(new Error('Cloud relay is not connected.'));
    }
    const requestId = `update-version-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const timeoutMs = this.clamp(options.timeoutMs, 1000, 60000, DEFAULT_TIMEOUT_MS);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Version check request timed out.'));
      }, timeoutMs);
      timeout.unref?.();
      this.pendingRequests.set(requestId, { resolve, reject, timeout });
      const sent = this.send({
        type: 'update:versionCheck',
        requestId,
        request
      });
      if (!sent) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(new Error('Cloud relay is not connected.'));
      }
    });
  }

  acknowledgeUpdateEvent(eventId, stage = 'received', status = 'ok', details = {}) {
    const normalizedEventId = String(eventId || '').trim();
    if (!normalizedEventId) return false;
    return this.send({
      type: 'update:available:ack',
      requestId: `update-available-ack-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      eventId: normalizedEventId,
      stage: String(stage || 'received').trim() || 'received',
      status: String(status || 'ok').trim() || 'ok',
      timestamp: nowIso(),
      details: details && typeof details === 'object' && !Array.isArray(details) ? details : {}
    });
  }

  markNotificationRead(notificationId) {
    return this.send({
      type: 'notification:read',
      requestId: `notification-read-${Date.now()}`,
      notificationId
    });
  }

  dismissNotification(notificationId) {
    return this.send({
      type: 'notification:dismiss',
      requestId: `notification-dismiss-${Date.now()}`,
      notificationId
    });
  }

  clearNotifications() {
    return this.send({
      type: 'notification:clear',
      requestId: `notification-clear-${Date.now()}`
    });
  }

  sendDeviceMutation(type, payload = {}, options = {}) {
    if (!this.isConnected()) {
      return Promise.reject(new Error('Connect to Relay Server first.'));
    }
    const requestId = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const timeoutMs = this.clamp(options.timeoutMs, 1000, 60000, DEFAULT_TIMEOUT_MS);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Cloud device request timed out.'));
      }, timeoutMs);
      timeout.unref?.();
      this.pendingRequests.set(requestId, { resolve, reject, timeout });
      const sent = this.send({
        ...payload,
        type,
        requestId
      });
      if (!sent) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(new Error('Cloud relay is not connected.'));
      }
    });
  }

  async destroy(reason = 'destroy') {
    this.removeAllListeners();
    return this.disconnect(reason);
  }

  async openSocket(nextState) {
    this.setState(nextState, { relayUrl: this.relayUrl });
    this.logger.info('Connection Started', { relayUrl: this.relayUrl, state: nextState });

    return new Promise(resolve => {
      let settled = false;
      const socket = new this.WebSocketImpl(this.relayUrl, {
        handshakeTimeout: this.settings.connectionTimeoutMs
      });
      this.socket = socket;

      const finish = status => {
        if (settled) return;
        settled = true;
        resolve(status || this.getStatus());
      };

      this.connectionTimer = setTimeout(() => {
        this.lastError = 'Unable to connect';
        this.logger.warn('Timeout', { relayUrl: this.relayUrl, timeoutMs: this.settings.connectionTimeoutMs });
        this.safeTerminate(socket);
      }, this.settings.connectionTimeoutMs);
      this.connectionTimer.unref?.();

      socket.once('open', () => {
        this.clearConnectionTimer();
        this.connectedAt = nowIso();
        this.lastConnectedAt = this.connectedAt;
        this.lastError = '';
        this.reconnectAttempts = 0;
        this.setState(STATES.CONNECTED, { relayUrl: this.relayUrl });
        this.registerDevice();
        this.startHeartbeat();
        this.logger.info('Connected', { relayUrl: this.relayUrl });
        finish(this.getStatus());
      });

      socket.on('message', data => this.handleMessage(data));
      socket.on('pong', () => this.handlePong());
      socket.on('error', error => {
        this.lastError = error.message || 'Cloud connection error';
        this.logger.warn('Unexpected Error', { error: this.lastError });
      });
      socket.once('close', (code, reasonBuffer) => {
        this.clearConnectionTimer();
        this.stopHeartbeat();
        if (this.socket === socket) this.socket = null;
        const reason = reasonBuffer?.toString?.() || '';
        this.connectedAt = null;
        this.lastDisconnectedAt = nowIso();
        this.clientId = '';
        this.serverVersion = '';
        this.device = null;
        this.owner = null;
        this.pairedDevices = [];
        this.presence = [];
        this.notifications = [];
        this.auth = null;
        this.rejectPendingRequests(new Error('Cloud connection closed.'));
        socket.removeAllListeners();

        if (this.userDisconnected || this.state === STATES.DISCONNECTING) {
          this.setState(STATES.DISCONNECTED, { code, reason });
          this.logger.info('Disconnected', { code, reason });
          finish(this.getStatus());
          return;
        }

        this.logger.warn('Server Closed', { code, reason });
        this.reliability.droppedConnections += 1;
        this.reliability.lastRecoveryAt = nowIso();
        this.handleUnexpectedDisconnect(`closed-${code || 'unknown'}`);
        finish(this.getStatus());
      });
    });
  }

  handleMessage(data) {
    let payload = null;
    try {
      payload = JSON.parse(data.toString('utf8'));
    } catch (_) {
      return;
    }
    if (payload?.type === 'connected') {
      this.clientId = String(payload.clientId || '');
      this.serverVersion = String(payload.version || '');
      this.emitStatus({ handshake: true });
      return;
    }
    if (payload?.type === 'device:registered') {
      this.device = payload.device || null;
      this.owner = payload.owner || null;
      this.applyAuthForCurrentDevice(payload.auth, 'device:registered');
      this.reliability.sessionRestoreCount += 1;
      this.reliability.state = 'healthy';
      this.emitStatus({ device: this.device, owner: this.owner });
      this.subscribePresence();
      this.requestNotificationList();
      return;
    }
    if (payload?.type === 'auth:refreshed') {
      this.applyAuthForCurrentDevice(payload.auth, 'auth:refreshed');
      this.emitStatus({ auth: Boolean(this.auth) });
      return;
    }
    if (payload?.type === 'auth:error') {
      this.logger.warn('Cloud auth warning', { code: payload.code, message: payload.message });
      if (payload.code === 'expired-token' && this.auth?.refreshToken) this.refreshAuth();
      return;
    }
    if (payload?.type === 'device:updated') {
      const updated = payload.device || null;
      if (updated?.deviceId) {
        if (this.device?.deviceId === updated.deviceId) this.device = updated;
        this.pairedDevices = this.pairedDevices.map(device => (
          device.deviceId === updated.deviceId ? { ...device, ...updated } : device
        ));
        this.emitStatus({ device: this.device, pairedDevices: this.pairedDevices });
      }
      this.resolvePendingRequest(payload.requestId, payload);
      return;
    }
    if (payload?.type === 'device:removed') {
      const removedId = payload.device?.deviceId || payload.deviceId || '';
      if (removedId) {
        this.pairedDevices = this.pairedDevices.filter(device => device.deviceId !== removedId);
        if (this.device?.deviceId === removedId) this.device = null;
        this.emitStatus({ device: this.device, pairedDevices: this.pairedDevices });
      }
      this.resolvePendingRequest(payload.requestId, payload);
      return;
    }
    if (payload?.type === 'device:list') {
      this.pairedDevices = Array.isArray(payload.devices) ? payload.devices : [];
      this.emitStatus({ pairedDevices: this.pairedDevices });
      this.resolvePendingRequest(payload.requestId, payload);
      return;
    }
    if (payload?.type === 'device:error') {
      this.logger.warn('Device registration error', {
        code: payload.code,
        message: payload.message
      });
      this.rejectPendingRequest(payload.requestId, new Error(payload.message || 'Cloud device request failed.'));
      return;
    }
    if (payload?.type === 'cloud-pair-token:created') {
      this.resolvePendingRequest(payload.requestId, payload);
      return;
    }
    if (payload?.type === 'cloud-pair:error') {
      this.rejectPendingRequest(payload.requestId, new Error(payload.message || 'Cloud pairing failed.'));
      this.emit('pairing-error', payload);
      return;
    }
    if (payload?.type === 'cloud-pair:request') {
      this.emit('pairing-request', payload);
      return;
    }
    if (payload?.type === 'cloud-pair:paired' || payload?.type === 'cloud-pair:rejected') {
      if (payload.type === 'cloud-pair:paired') {
        this.applyAuthForCurrentDevice(payload.auth, 'cloud-pair:paired');
        this.pairedDevices = Array.isArray(payload.devices) ? payload.devices : [];
        this.emitStatus({ pairedDevices: this.pairedDevices });
      }
      this.emit('pairing-result', payload);
      return;
    }
    if (payload?.type === 'relay:packet') {
      const message = this.unprotectRelayMessage(payload);
      if (message) this.emit('relay-packet', message);
      return;
    }
    if (payload?.type === 'relay:ack') {
      this.reliability.state = 'healthy';
      this.emit('relay-ack', payload);
      return;
    }
    if (payload?.type === 'relay:error') {
      this.emit('relay-error', payload);
      return;
    }
    if (payload?.type === 'presence:update') {
      this.upsertPresence(payload.presence);
      this.emit('presence', this.presence.slice());
      this.emitStatus({ presence: this.presence.slice() });
      return;
    }
    if (payload?.type === 'presence:list' || payload?.type === 'presence:subscribed') {
      this.presence = Array.isArray(payload.presence) ? payload.presence : [];
      this.emit('presence', this.presence.slice());
      this.emitStatus({ presence: this.presence.slice() });
      return;
    }
    if (payload?.type === 'notification:new') {
      this.upsertNotification(payload.notification);
      this.emit('notification', payload.notification);
      this.emit('notifications', this.notifications.slice());
      this.emitStatus({ notifications: this.notifications.slice() });
      return;
    }
    if (payload?.type === 'notification:list') {
      this.notifications = Array.isArray(payload.notifications) ? payload.notifications : [];
      this.emit('notifications', this.notifications.slice());
      this.emitStatus({ notifications: this.notifications.slice() });
      return;
    }
    if (['notification:read', 'notification:dismiss', 'notification:queued'].includes(payload?.type)) {
      if (payload.notification) this.upsertNotification(payload.notification);
      this.emit('notifications', this.notifications.slice());
      this.emitStatus({ notifications: this.notifications.slice() });
      return;
    }
    if (payload?.type === 'update:versionResult') {
      this.resolvePendingRequest(payload.requestId, payload);
      this.emit('update-version-result', payload);
      return;
    }
    if (payload?.type === 'update:versionError') {
      const error = new Error(payload.message || 'Version check failed.');
      error.code = payload.errorCode || 'VERSION_CHECK_FAILED';
      this.rejectPendingRequest(payload.requestId, error);
      this.emit('update-version-error', payload);
      return;
    }
    if (payload?.type === 'update:available') {
      this.emit('update-available', payload);
      return;
    }
    if (payload?.type === 'update:available:ack:recorded') {
      this.emit('update-available-ack-recorded', payload);
      return;
    }
    if (payload?.type === 'update:available:ack:error') {
      this.emit('update-available-ack-error', payload);
      return;
    }
    if (payload?.type === 'notification:deleted') {
      this.notifications = this.notifications.filter(item => item.notificationId !== payload.notificationId);
      this.emit('notifications', this.notifications.slice());
      this.emitStatus({ notifications: this.notifications.slice() });
      return;
    }
    if (payload?.type === 'notification:cleared') {
      this.notifications = [];
      this.emit('notifications', this.notifications.slice());
      this.emitStatus({ notifications: this.notifications.slice() });
    }
  }

  upsertPresence(presence) {
    if (!presence?.deviceId) return false;
    const index = this.presence.findIndex(item => item.deviceId === presence.deviceId);
    if (index >= 0) this.presence[index] = { ...this.presence[index], ...presence };
    else this.presence.push(presence);
    return true;
  }

  upsertNotification(notification) {
    if (!notification?.notificationId) return false;
    const index = this.notifications.findIndex(item => item.notificationId === notification.notificationId);
    if (index >= 0) this.notifications[index] = { ...this.notifications[index], ...notification };
    else this.notifications.unshift(notification);
    this.notifications.sort((left, right) => {
      const weights = { low: 0, normal: 1, high: 2, critical: 3 };
      return (weights[right.priority] || 0) - (weights[left.priority] || 0) ||
        Number(right.createdAt || 0) - Number(left.createdAt || 0);
    });
    this.notifications = this.notifications.slice(0, 100);
    return true;
  }

  resolvePendingRequest(requestId, payload) {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return false;
    clearTimeout(pending.timeout);
    this.pendingRequests.delete(requestId);
    pending.resolve(payload);
    return true;
  }

  rejectPendingRequest(requestId, error) {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return false;
    clearTimeout(pending.timeout);
    this.pendingRequests.delete(requestId);
    pending.reject(error);
    return true;
  }

  rejectPendingRequests(error) {
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pendingRequests.delete(requestId);
    }
  }

  handlePong() {
    if (this.pendingPingAt > 0) {
      this.latencyMs = Math.max(0, this.now() - this.pendingPingAt);
      this.pendingPingAt = 0;
      this.emitStatus({ latencyMs: this.latencyMs });
    }
  }

  registerDevice() {
    if (!this.settings.deviceId) return false;
    return this.send({
      type: 'device:register',
      requestId: `desktop-device-${Date.now()}`,
      deviceId: this.settings.deviceId,
      ownerId: this.settings.ownerId,
      deviceType: this.settings.deviceType || 'desktop',
      friendlyName: this.settings.friendlyName || 'OpenX Desktop',
      platform: process.platform,
      softwareVersion: this.version,
      capabilities: {
        cloudPairing: true,
        localFirst: true
      }
    });
  }

  setE2EEMasterKey(masterKey) {
    const applied = this.secureChannel.setMasterKey(masterKey);
    this.emitStatus({ security: this.getSecurityStatus() });
    return applied;
  }

  getSecurityStatus() {
    return this.secureChannel.getStatus();
  }

  protectRelayPacket(packet) {
    try {
      return this.secureChannel.encryptPacket(packet);
    } catch (error) {
      this.logger.warn('E2EE packet encryption failed', { error: error.message });
      return packet;
    }
  }

  unprotectRelayMessage(message) {
    try {
      const packet = this.secureChannel.decryptPacket(message.packet || {});
      return { ...message, packet };
    } catch (error) {
      this.logger.warn('E2EE packet rejected', {
        packetId: message?.packet?.packetId || null,
        requestId: message?.packet?.requestId || null,
        error: error.message
      });
      this.emit('relay-error', {
        type: 'relay:error',
        code: 'e2ee-packet-rejected',
        packetId: message?.packet?.packetId || null,
        requestId: message?.packet?.requestId || null,
        message: 'Encrypted packet could not be authenticated.'
      });
      return null;
    }
  }

  applyAuthForCurrentDevice(auth, source = 'auth') {
    if (!auth?.accessToken) return false;
    const tokenDeviceId = readAccessTokenDeviceId(auth);
    const currentDeviceId = String(this.device?.deviceId || this.settings.deviceId || '').trim();
    if (tokenDeviceId && currentDeviceId && tokenDeviceId !== currentDeviceId) {
      this.logger.warn('Ignored auth token for different cloud device', {
        source,
        tokenDeviceId,
        currentDeviceId
      });
      return false;
    }
    this.auth = auth;
    return true;
  }

  handleUnexpectedDisconnect(reason) {
    this.stopHeartbeat();
    if (this.userDisconnected || this.settings.reconnectEnabled === false) {
      this.setState(STATES.ERROR, { reason, friendlyMessage: 'Disconnected from cloud relay.' });
      return;
    }
    this.scheduleReconnect(reason);
  }

  scheduleReconnect(reason) {
    this.clearReconnectTimer();
    this.reconnectAttempts += 1;
    const baseDelay = DEFAULT_RECONNECT_DELAYS[Math.min(this.reconnectAttempts - 1, DEFAULT_RECONNECT_DELAYS.length - 1)];
    const delay = withReconnectJitter(baseDelay);
    this.reliability.state = 'reconnecting';
    this.reliability.reconnectCount += 1;
    this.setState(STATES.RECONNECTING, { reason, delayMs: delay, reconnectAttempts: this.reconnectAttempts });
    this.logger.info('Reconnect Started', { reason, delayMs: delay, reconnectAttempts: this.reconnectAttempts });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket(STATES.RECONNECTING).then(status => {
        if (status.state === STATES.CONNECTED) {
          this.reliability.state = 'healthy';
          this.logger.info('Reconnect Success', { relayUrl: this.relayUrl });
        } else {
          this.logger.warn('Reconnect Failed', { state: status.state, reconnectAttempts: this.reconnectAttempts });
        }
      }).catch(error => {
        this.lastError = error.message;
        this.logger.warn('Reconnect Failed', { error: error.message, reconnectAttempts: this.reconnectAttempts });
        this.scheduleReconnect('reconnect-error');
      });
    }, delay);
    this.reconnectTimer.unref?.();
  }

  startHeartbeat() {
    this.stopHeartbeat();
    if (!this.settings.heartbeatEnabled) return;
    this.heartbeatTimer = setInterval(() => {
      if (!socketIsOpen(this.socket)) return;
      try {
        this.pendingPingAt = this.now();
        this.socket.ping();
      } catch (error) {
        this.lastError = error.message;
        this.logger.warn('Heartbeat failed', { error: error.message });
        this.safeTerminate(this.socket);
      }
    }, this.settings.heartbeatIntervalMs);
    this.heartbeatTimer.unref?.();
  }

  restartHeartbeat() {
    if (this.isConnected()) this.startHeartbeat();
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.pendingPingAt = 0;
  }

  clearConnectionTimer() {
    if (this.connectionTimer) clearTimeout(this.connectionTimer);
    this.connectionTimer = null;
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  closeSocket(socket, code, reason) {
    return new Promise(resolve => {
      if (!socket || socket.readyState === WebSocket.CLOSED) {
        resolve();
        return;
      }
      const done = () => {
        socket.removeAllListeners();
        resolve();
      };
      const timer = setTimeout(() => {
        this.safeTerminate(socket);
        done();
      }, 1000);
      timer.unref?.();
      socket.once('close', () => {
        clearTimeout(timer);
        done();
      });
      try {
        if ([WebSocket.OPEN, WebSocket.CONNECTING].includes(socket.readyState)) {
          socket.close(code, reason);
        } else {
          this.safeTerminate(socket);
        }
      } catch (_) {
        this.safeTerminate(socket);
      }
    });
  }

  safeTerminate(socket) {
    try {
      socket?.terminate?.();
    } catch (_) {}
  }

  getWebSocketUrl(url) {
    return normalizeRelayUrl(url);
  }

  setState(state, meta = {}) {
    this.state = state;
    this.emitStatus(meta);
  }

  emitStatus(meta = {}) {
    this.emit('status', this.getStatus(meta));
  }

  getStatus(meta = {}) {
    const connectedSince = this.connectedAt ? new Date(this.connectedAt).getTime() : 0;
    return {
      state: this.state,
      connected: this.isConnected(),
      relayUrl: this.relayUrl || this.settings.relayUrl,
      lastConnectedAt: this.lastConnectedAt,
      lastDisconnectedAt: this.lastDisconnectedAt,
      connectedAt: this.connectedAt,
      connectionDurationMs: connectedSince ? Math.max(0, Date.now() - connectedSince) : 0,
      pingMs: this.getLatency(),
      reconnectAttempts: this.reconnectAttempts,
      version: this.version,
      serverVersion: this.serverVersion,
      clientId: this.clientId,
      device: this.device,
      owner: this.owner,
      pairedDevices: this.pairedDevices.slice(),
      presence: this.presence.slice(),
      notifications: this.notifications.slice(),
      reliability: this.getReliabilityStatus(),
      security: this.getSecurityStatus(),
      authenticated: Boolean(this.auth?.accessToken),
      friendlyMessage: this.getFriendlyMessage(),
      error: this.state === STATES.ERROR ? this.lastError : '',
      settings: { ...this.settings },
      ...meta
    };
  }

  withAuth(payload) {
    const type = String(payload?.type || '');
    if (!this.auth?.accessToken || type === 'device:register' || type.startsWith('auth:')) return payload;
    return { ...payload, accessToken: this.auth.accessToken };
  }

  refreshAuth() {
    if (!this.auth?.refreshToken) return false;
    return this.send({
      type: 'auth:refresh',
      requestId: `auth-refresh-${Date.now()}`,
      refreshToken: this.auth.refreshToken
    });
  }

  getReliabilityStatus(state = this.reliability.state) {
    return {
      ...this.reliability,
      state,
      reconnectAttempts: this.reconnectAttempts,
      retryQueueSize: 0
    };
  }

  getFriendlyMessage() {
    if (this.state === STATES.CONNECTED) return 'Connected to the relay server.';
    if (this.state === STATES.CONNECTING) return 'Connecting to the relay server...';
    if (this.state === STATES.RECONNECTING) return 'Connection dropped. Reconnecting safely...';
    if (this.state === STATES.DISCONNECTING) return 'Disconnecting from the relay server...';
    if (this.state === STATES.ERROR) return this.lastError ? 'Unable to connect.' : 'Cloud connection needs attention.';
    return 'Cloud mode is disconnected. Local mode is active.';
  }
}

CloudConnectionManager.STATES = STATES;
CloudConnectionManager.normalizeRelayUrl = normalizeRelayUrl;

module.exports = CloudConnectionManager;
