const { URL } = require('url');
const { WebSocket, WebSocketServer } = require('ws');
const PhoneConnectionManager = require('./PhoneConnectionManager');
const FileTransferProtocol = require('./FileTransferProtocol');
const QRPairingService = require('./QRPairingService');
const SecurityManager = require('./SecurityManager');

const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_PORT = 8080;
const MAX_COMMAND_LENGTH = 5000;
const MAX_PAYLOAD_BYTES = FileTransferProtocol.MAX_WEBSOCKET_PAYLOAD_BYTES;
const TRACKED_TRANSFER_RETENTION_MS = 11 * 60 * 1000;
const POWER_ACTION_IDS = new Set([
  'system.shutdown',
  'system.restart',
  'system.sleep',
  'system.logoff',
  'system.lock'
]);

class PhoneServer {
  constructor(options = {}) {
    if (!options.commandRouter || typeof options.commandRouter.route !== 'function') {
      throw new TypeError('PhoneServer requires a command router');
    }
    if (!options.pairingService || typeof options.pairingService.pairDevice !== 'function') {
      throw new TypeError('PhoneServer requires a pairing service');
    }

    this.host = options.host ?? DEFAULT_HOST;
    this.port = options.port ?? DEFAULT_PORT;
    this.protocolVersion = options.protocolVersion ?? QRPairingService.PROTOCOL_VERSION;
    this.resolveServerIp = options.resolveServerIp || QRPairingService.resolveDesktopIpv4;
    this.commandRouter = options.commandRouter;
    this.pairingService = options.pairingService;
    this.fileTransferManager = options.fileTransferManager || null;
    this.logger = options.logger || console;
    this.sessionManager = options.sessionManager || this.pairingService.sessionManager;
    this.securityManager = options.securityManager || new SecurityManager({
      deviceRegistry: this.pairingService.deviceRegistry,
      sessionManager: this.sessionManager,
      now: options.now || this.sessionManager.now,
      logger: this.logger
    });
    this.connectionManager = options.connectionManager || new PhoneConnectionManager();
    this.clients = this.connectionManager.clients;
    this.activeTransfersByClient = new Map();
    this.transferCleanupTimers = new Map();
    this.messageQueues = new Map();
    this.setTimer = options.setTimeout || setTimeout;
    this.clearTimer = options.clearTimeout || clearTimeout;
    this.server = null;
    this.startPromise = null;
  }

  start() {
    if (this.startPromise) return this.startPromise;
    if (this.server) return Promise.resolve(this.address());

    this.startPromise = new Promise((resolve, reject) => {
      const server = new WebSocketServer({
        host: this.host,
        port: this.port,
        maxPayload: MAX_PAYLOAD_BYTES
      });
      this.server = server;

      const onStartupError = error => {
        server.removeListener('listening', onListening);
        this.server = null;
        this.startPromise = null;
        this.logger.error('[PHONE] Server Error', { error: error.message });
        try {
          server.close();
        } catch (_) {
          // The server may not have completed binding.
        }
        reject(error);
      };
      const onListening = () => {
        server.removeListener('error', onStartupError);
        server.on('error', error => {
          this.logger.error('[PHONE] Server Error', { error: error.message });
        });
        this.startPromise = null;
        this.logger.info('[PHONE] Server Listening', this.address());
        resolve(this.address());
      };

      server.once('error', onStartupError);
      server.once('listening', onListening);
      server.on('connection', (socket, request) => this._handleConnection(socket, request));
    });

    return this.startPromise;
  }

  async stop() {
    const server = this.server;
    this.server = null;
    this.startPromise = null;
    if (!server) {
      for (const clientId of this.activeTransfersByClient.keys()) {
        this._abortClientTransfers(clientId, 'server_stopped');
      }
      this._clearTransferCleanupTimers();
      this.connectionManager.clear();
      this.messageQueues.clear();
      this.pairingService.destroy?.();
      return;
    }

    for (const client of this.clients.values()) {
      try {
        client.socket.close(1001, 'Desktop shutting down');
        client.socket.terminate();
      } catch (_) {
        client.socket.terminate?.();
      }
    }
    for (const clientId of this.activeTransfersByClient.keys()) {
      this._abortClientTransfers(clientId, 'server_stopped');
    }
    this.connectionManager.clear();
    this.activeTransfersByClient.clear();
    this._clearTransferCleanupTimers();
    this.messageQueues.clear();
    this.pairingService.destroy?.();

    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
    this.logger.info('[PHONE] Server Stopped');
  }

  address() {
    const address = this.server?.address();
    if (!address || typeof address === 'string') {
      return { host: this.host, port: this.port };
    }
    return { host: address.address, port: address.port };
  }

  getConnectionInfo() {
    const address = this.address();
    let serverIp = '127.0.0.1';
    try {
      serverIp = this.resolveServerIp();
    } catch (error) {
      this.logger.warn('[PHONE] Failed to resolve desktop IP', { error: error.message });
    }
    return {
      host: address.host,
      serverIp,
      serverPort: address.port,
      protocolVersion: this.protocolVersion,
      currentVersion: this.protocolVersion
    };
  }

  getStatus() {
    const connection = this.getConnectionInfo();
    return {
      serverStatus: this.server ? 'listening' : 'stopped',
      running: Boolean(this.server),
      currentIp: connection.serverIp,
      currentPort: connection.serverPort,
      currentVersion: connection.currentVersion,
      protocolVersion: connection.protocolVersion,
      host: connection.host,
      connectedDevices: [...this.clients.values()]
        .filter(client => client.deviceId)
        .map(client => ({
          deviceId: client.deviceId,
          deviceName: client.deviceName,
          connectedAt: client.connectedAt,
          lastSeen: client.lastSeen
        }))
    };
  }

  broadcast(payload) {
    let sent = 0;
    for (const clientId of this.clients.keys()) {
      if (this.sendToClient(clientId, payload)) sent += 1;
    }
    return sent;
  }

  sendToClient(clientId, payload) {
    const client = this.connectionManager.get(clientId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) return false;

    const outgoingPayload = this._normalizeOutgoingPayload(payload);
    const serialized = typeof outgoingPayload === 'string' ? outgoingPayload : JSON.stringify(outgoingPayload);
    client.socket.send(serialized, error => {
      if (error) {
        this.logger.error('[PHONE] Send Error', { clientId, error: error.message });
      }
    });
    this.logger.info('[PHONE] Response Sent', { clientId, type: outgoingPayload?.type });
    return true;
  }

  sendToDevice(deviceId, payload) {
    for (const [clientId, client] of this.clients) {
      if (client.deviceId === deviceId && this.sendToClient(clientId, payload)) return true;
    }
    return false;
  }

  disconnectDevice(deviceId) {
    let disconnected = 0;
    for (const client of this.clients.values()) {
      if (client.deviceId !== deviceId) continue;
      disconnected += 1;
      client.socket.close(1008, 'Device disconnected by desktop');
    }
    return disconnected;
  }

  revokeDeviceSession(deviceId) {
    this.securityManager.clearDevice(deviceId);
    return this.sessionManager.revokeSession(deviceId);
  }

  getDeviceSession(deviceId) {
    return this.sessionManager.getSession(deviceId);
  }

  _handleConnection(socket, request) {
    const metadata = this._readClientMetadata(request);
    const clientId = this.connectionManager.add(socket, metadata);
    this.logger.info('[PHONE] Connected', { clientId, ...metadata });
    this.sendToClient(clientId, { type: 'status', status: 'connected' });

    socket.on('message', data => this._enqueueClientMessage(clientId, data));
    socket.on('close', () => {
      this._abortClientTransfers(clientId, 'connection_closed');
      this.messageQueues.delete(clientId);
      this.connectionManager.remove(clientId);
      this.logger.info('[PHONE] Disconnected', { clientId, deviceName: metadata.deviceName });
    });
    socket.on('error', error => {
      this.logger.error('[PHONE] Connection Error', { clientId, error: error.message });
    });
  }

  _enqueueClientMessage(clientId, data) {
    if (!this._isClientOpen(clientId)) return;
    const previous = this.messageQueues.get(clientId) || Promise.resolve();
    const next = previous
      .catch(() => {})
      .then(() => {
        if (!this._isClientOpen(clientId)) return null;
        return this._handleMessage(clientId, data);
      })
      .catch(error => {
        this.logger.error('[PHONE] Command Error', { clientId, error: error.message });
        this.sendToClient(clientId, { type: 'error', message: 'Unable to execute command' });
      });
    this.messageQueues.set(clientId, next);
    next.finally(() => {
      if (this.messageQueues.get(clientId) === next) {
        this.messageQueues.delete(clientId);
      }
    });
  }

  async _handleMessage(clientId, data) {
    if (!this._isClientOpen(clientId)) return;
    this.connectionManager.touch(clientId);
    this.logger.info('[PHONE] Message Received', { clientId });

    let payload;
    try {
      payload = JSON.parse(data.toString('utf8'));
    } catch (_) {
      this.sendToClient(clientId, { type: 'error', message: 'Invalid message format' });
      return;
    }

    if (payload?.type === 'pair') {
      this._handlePairRequest(clientId, payload);
      return;
    }

    if (payload?.type === 'file-transfer') {
      await this._handleFileTransfer(clientId, payload);
      return;
    }

    if (
      payload?.type === 'file-transfer-start' ||
      payload?.type === 'file-transfer-chunk' ||
      payload?.type === 'file-transfer-complete'
    ) {
      await this._handleChunkedFileTransfer(clientId, payload);
      return;
    }

    if (payload?.type === 'file-transfer-received') {
      this._handleFileTransferReceipt(clientId, payload);
      return;
    }

    if (payload?.type === 'device-update') {
      this._handleDeviceUpdate(clientId, payload);
      return;
    }

    if (
      !payload ||
      payload.type !== 'command' ||
      typeof payload.message !== 'string' ||
      payload.message.trim().length === 0 ||
      payload.message.length > MAX_COMMAND_LENGTH
    ) {
      this.sendToClient(clientId, { type: 'error', message: 'Invalid command' });
      return;
    }

    const client = this.connectionManager.get(clientId);
    const authentication = this._authenticateRequest(clientId, client, payload);
    if (!authentication) return;
    const deviceId = authentication.deviceId;
    const registry = this.pairingService.deviceRegistry;
    if (!registry.hasPermission(deviceId, 'remoteCommands')) {
      this.logger.info('[PHONE] Permission denied', { deviceId, permission: 'remoteCommands' });
      this.sendToClient(clientId, { type: 'error', message: 'Remote commands disabled.' });
      return;
    }

    const device = this._applyDeviceNameFromPayload(deviceId, payload) || registry.getDevice(deviceId);
    this.connectionManager.setDevice(clientId, device);
    registry.updateLastSeen(deviceId);

    const result = await this.commandRouter.route(payload.message, {
      permissionGuard: this._createPermissionGuard(deviceId),
      phoneContext: {
        deviceId,
        deviceName: device?.deviceName || client?.deviceName || null
      }
    });
    const message = result?.response || result?.message || 'Command completed';
    this.sendToClient(clientId, {
      type: 'response',
      success: result?.success === true,
      commandId: result?.commandId || null,
      intent: result?.intent || null,
      needsClarification: result?.needsClarification === true,
      requiresConfirmation: result?.requiresConfirmation === true,
      entities: result?.entities || {},
      data: result?.data || null,
      error: result?.error || null,
      message,
      timestamp: Number.isFinite(payload.timestamp) ? payload.timestamp : Date.now()
    });
  }

  _handleDeviceUpdate(clientId, payload) {
    const client = this.connectionManager.get(clientId);
    const authentication = this._authenticateRequest(clientId, client, payload);
    if (!authentication) return;

    if (typeof payload?.deviceName !== 'string' || payload.deviceName.trim().length === 0) {
      this.sendToClient(clientId, { type: 'error', message: 'Invalid device name' });
      return;
    }

    const device = this._applyDeviceNameFromPayload(authentication.deviceId, payload);
    if (!device) {
      this.sendToClient(clientId, { type: 'error', message: 'Invalid device name' });
      return;
    }

    this.connectionManager.setDevice(clientId, device);
    this.pairingService.deviceRegistry.updateLastSeen(authentication.deviceId);
    this.sendToClient(clientId, {
      type: 'device-updated',
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      timestamp: Number.isFinite(payload.timestamp) ? payload.timestamp : Date.now()
    });
  }

  _applyDeviceNameFromPayload(deviceId, payload) {
    const deviceName = typeof payload?.deviceName === 'string'
      ? payload.deviceName.replace(/\s+/g, ' ').trim()
      : '';
    if (!deviceName) return this.pairingService.deviceRegistry.getDevice(deviceId);
    try {
      return this.pairingService.deviceRegistry.updateDeviceName(deviceId, deviceName);
    } catch (_) {
      return null;
    }
  }

  _handlePairRequest(clientId, payload) {
    const result = this.pairingService.pairDevice(payload);
    if (!result.valid) {
      this.logger.warn('[PHONE] Pairing Failed', { clientId, reason: result.reason });
      this.sendToClient(clientId, { type: 'pair-failed' });
      return;
    }

    this.connectionManager.setDevice(clientId, result.device);
    this.logger.info('[PHONE] Device Paired', {
      clientId,
      deviceId: result.device.deviceId,
      deviceName: result.device.deviceName
    });
    this.sendToClient(clientId, {
      type: 'pair-success',
      deviceId: result.device.deviceId,
      sessionToken: result.session.sessionToken,
      issuedAt: result.session.issuedAt,
      expiresAt: result.session.expiresAt,
      serverIp: this.getConnectionInfo().serverIp,
      serverPort: this.getConnectionInfo().serverPort
    });
  }

  async _handleFileTransfer(clientId, payload) {
    const client = this.connectionManager.get(clientId);
    const authentication = this._authenticateRequest(clientId, client, payload);
    if (!authentication) return;
    const deviceId = authentication.deviceId;
    if (!this.fileTransferManager) {
      this.sendToClient(clientId, {
        type: 'error',
        transferId: payload.transferId || payload.requestId || null,
        message: 'File transfer unavailable'
      });
      return;
    }

    try {
      const result = await this.fileTransferManager.receiveFile({ ...payload, deviceId });
      const device = this.pairingService.deviceRegistry.getDevice(deviceId);
      if (device) this.connectionManager.setDevice(clientId, device);
      this.sendToClient(clientId, {
        type: 'file-transfer-success',
        fileName: result.record.fileName,
        fileSize: result.record.size,
        savedTo: result.filePath
      });
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'error',
        transferId: payload.transferId || payload.requestId || null,
        code: error.code || 'file_transfer_failed',
        message: error.publicMessage || 'File transfer failed'
      });
    }
  }

  async _handleChunkedFileTransfer(clientId, payload) {
    const client = this.connectionManager.get(clientId);
    const authentication = this._authenticateRequest(clientId, client, payload);
    if (!authentication) return;
    const deviceId = authentication.deviceId;
    if (!this.fileTransferManager) {
      this.sendToClient(clientId, {
        type: 'error',
        transferId: payload.transferId || payload.requestId || null,
        message: 'File transfer unavailable'
      });
      return;
    }

    try {
      if (payload.type === 'file-transfer-start') {
        const result = await this.fileTransferManager.startIncomingTransfer({ ...payload, deviceId });
        this._trackClientTransfer(clientId, result.transferId);
        this.sendToClient(clientId, {
          type: 'file-transfer-started',
          transferId: result.transferId,
          fileName: result.fileName,
          fileSize: result.fileSize
        });
        return;
      }

      if (payload.type === 'file-transfer-chunk') {
        const progress = await this.fileTransferManager.receiveFileChunk({ ...payload, deviceId });
        if (progress.complete || progress.receivedBytes % (1024 * 1024) === 0) {
          this.sendToClient(clientId, {
            type: 'file-transfer-progress',
            transferId: progress.transferId,
            receivedBytes: progress.receivedBytes,
            fileSize: progress.fileSize
          });
        }
        return;
      }

      const result = await this.fileTransferManager.completeIncomingTransfer({ ...payload, deviceId });
      this._untrackClientTransfer(clientId, payload.transferId);
      const device = this.pairingService.deviceRegistry.getDevice(deviceId);
      if (device) this.connectionManager.setDevice(clientId, device);
      this.sendToClient(clientId, {
        type: 'file-transfer-success',
        transferId: payload.transferId,
        fileName: result.record.fileName,
        fileSize: result.record.size,
        savedTo: result.filePath
      });
    } catch (error) {
      if (payload.transferId) this._untrackClientTransfer(clientId, payload.transferId);
      this.sendToClient(clientId, {
        type: 'error',
        transferId: payload.transferId || payload.requestId || null,
        code: error.code || 'file_transfer_failed',
        message: error.publicMessage || 'File transfer failed'
      });
    }
  }

  _normalizeOutgoingPayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
    if (payload.type !== 'file-transfer') return payload;
    return {
      ...payload,
      type: 'incoming-file',
      originalType: 'file-transfer'
    };
  }

  _handleFileTransferReceipt(clientId, payload) {
    const client = this.connectionManager.get(clientId);
    const authentication = this._authenticateRequest(clientId, client, payload);
    if (!authentication) return;
    const transferId = String(payload.transferId || payload.requestId || '').trim();
    const status = payload.success === false ? 'failed' : 'received';
    this.logger.info('[PHONE] Transfer receipt', {
      clientId,
      deviceId: authentication.deviceId,
      transferId: transferId || null,
      status,
      fileName: payload.fileName || null,
      error: payload.error || null
    });
  }

  _trackClientTransfer(clientId, transferId) {
    const id = String(transferId || '').trim();
    if (!id) return;
    const transfers = this.activeTransfersByClient.get(clientId) || new Set();
    transfers.add(id);
    this.activeTransfersByClient.set(clientId, transfers);
    const key = this._transferTrackKey(clientId, id);
    const previousTimer = this.transferCleanupTimers.get(key);
    if (previousTimer) this.clearTimer(previousTimer);
    const timer = this.setTimer(() => this._untrackClientTransfer(clientId, id), TRACKED_TRANSFER_RETENTION_MS);
    if (typeof timer?.unref === 'function') timer.unref();
    this.transferCleanupTimers.set(key, timer);
  }

  _untrackClientTransfer(clientId, transferId) {
    const id = String(transferId || '').trim();
    const key = this._transferTrackKey(clientId, id);
    const timer = this.transferCleanupTimers.get(key);
    if (timer) this.clearTimer(timer);
    this.transferCleanupTimers.delete(key);
    const transfers = this.activeTransfersByClient.get(clientId);
    if (!transfers) return;
    transfers.delete(id);
    if (transfers.size === 0) this.activeTransfersByClient.delete(clientId);
  }

  _abortClientTransfers(clientId, reason) {
    const transfers = this.activeTransfersByClient.get(clientId);
    if (!transfers || !this.fileTransferManager) return;
    this.activeTransfersByClient.delete(clientId);
    this._clearTransferCleanupTimers(clientId);
    for (const transferId of transfers) {
      this.fileTransferManager.abortIncomingTransfer?.(transferId, reason).catch(error => {
        this.logger.warn('[PHONE] Transfer cleanup failed', { clientId, transferId, error: error.message });
      });
    }
  }

  _transferTrackKey(clientId, transferId) {
    return `${clientId}:${transferId}`;
  }

  _clearTransferCleanupTimers(clientId = null) {
    for (const [key, timer] of this.transferCleanupTimers) {
      if (clientId && !key.startsWith(`${clientId}:`)) continue;
      this.clearTimer(timer);
      this.transferCleanupTimers.delete(key);
    }
  }

  _isClientOpen(clientId) {
    const client = this.connectionManager.get(clientId);
    return Boolean(client && client.socket?.readyState === WebSocket.OPEN);
  }

  _resolveDeviceId(client, payload) {
    const payloadDeviceId = typeof payload.deviceId === 'string' ? payload.deviceId.trim() : '';
    if (client?.deviceId && payloadDeviceId && client.deviceId !== payloadDeviceId) return '';
    return client?.deviceId || payloadDeviceId;
  }

  _authenticateRequest(clientId, client, payload) {
    const deviceId = this._resolveDeviceId(client, payload);
    const payloadType = String(payload?.type || '');
    const transferId = payloadType.startsWith('file-transfer')
      ? (payload?.transferId || payload?.requestId || null)
      : null;
    if (!deviceId || deviceId !== payload.deviceId) {
      this.logger.warn('[PHONE] Authentication failure', {
        deviceId: payload?.deviceId || null,
        reason: 'device-mismatch'
      });
      const errorPayload = {
        type: 'error',
        message: 'Authentication failed.'
      };
      if (transferId) errorPayload.transferId = transferId;
      this.sendToClient(clientId, errorPayload);
      return null;
    }
    const result = this.securityManager.validateConnection(payload);
    if (!result.valid) {
      const errorPayload = {
        type: 'error',
        message: result.message
      };
      if (transferId) errorPayload.transferId = transferId;
      this.sendToClient(clientId, errorPayload);
      return null;
    }
    return result;
  }

  _createPermissionGuard(deviceId) {
    return intent => {
      const intentId = String(intent?.id || intent?.action || '').toLowerCase();
      if (!POWER_ACTION_IDS.has(intentId)) return { allowed: true };
      if (this.pairingService.deviceRegistry.hasPermission(deviceId, 'powerActions')) {
        return { allowed: true };
      }
      this.logger.info('[PHONE] Permission denied', { deviceId, permission: 'powerActions', intent: intentId });
      return { allowed: false, response: 'Power actions disabled.' };
    };
  }

  _readClientMetadata(request) {
    try {
      const url = new URL(request?.url || '/', 'ws://localhost');
      const deviceName = url.searchParams.get('deviceName')?.trim();
      const deviceId = url.searchParams.get('deviceId')?.trim();
      return {
        deviceName: deviceName ? deviceName.slice(0, 100) : 'Unknown device',
        deviceId: deviceId ? deviceId.slice(0, 128) : null
      };
    } catch (_) {
      return { deviceName: 'Unknown device', deviceId: null };
    }
  }
}

PhoneServer.DEFAULT_HOST = DEFAULT_HOST;
PhoneServer.DEFAULT_PORT = DEFAULT_PORT;

module.exports = PhoneServer;
