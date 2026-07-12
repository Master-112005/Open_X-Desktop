const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const CloudFileTransferProtocol = require('./CloudFileTransferProtocol');
const CloudTransferIntegrity = require('./CloudTransferIntegrity');

const PROTOCOL_VERSION = 1;
const DEFAULT_CHUNK_BYTES = 12 * 1024;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;
}

function safeBaseName(value) {
  return path.basename(String(value || 'file').trim() || 'file');
}

class CloudFileTransferManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.connectionManager = options.connectionManager;
    this.protocol = options.protocol || new CloudFileTransferProtocol();
    this.integrity = options.integrity || new CloudTransferIntegrity();
    this.receiveDirectory = options.receiveDirectory || null;
    this.tempDirectory = options.tempDirectory || null;
    this.logger = options.logger || console;
    this.chunkBytes = Number.isFinite(options.chunkBytes)
      ? Math.max(1024, Math.round(options.chunkBytes))
      : DEFAULT_CHUNK_BYTES;
    this.timeoutMs = Number.isFinite(options.timeoutMs)
      ? Math.max(5000, Math.round(options.timeoutMs))
      : DEFAULT_TIMEOUT_MS;
    this.outgoing = new Map();
    this.incoming = new Map();
    this.started = false;
    this.boundPacketHandler = message => this.handleRelayPacket(message);
    this.boundRelayErrorHandler = message => this.handleRelayError(message);
  }

  start() {
    if (this.started || !this.connectionManager) return false;
    this.connectionManager.on('relay-packet', this.boundPacketHandler);
    this.connectionManager.on('relay-error', this.boundRelayErrorHandler);
    this.started = true;
    return true;
  }

  destroy() {
    if (this.started && this.connectionManager) {
      this.connectionManager.off('relay-packet', this.boundPacketHandler);
      this.connectionManager.off('relay-error', this.boundRelayErrorHandler);
    }
    this.started = false;
    for (const transfer of this.incoming.values()) this.cleanupIncoming(transfer, 'destroy');
    for (const transfer of this.outgoing.values()) this.cleanupOutgoing(transfer, 'destroy');
    this.incoming.clear();
    this.outgoing.clear();
    this.removeAllListeners();
  }

  getConnectedDevices() {
    const status = this.connectionManager?.getStatus?.() || {};
    const desktopId = status.device?.deviceId || '';
    const devices = Array.isArray(status.pairedDevices) ? status.pairedDevices : [];
    return devices
      .filter(device => device?.deviceId && device.deviceId !== desktopId)
      .map(device => ({
        deviceId: device.deviceId,
        deviceName: device.friendlyName || device.deviceName || device.deviceId,
        connectedAt: device.connectedAt || null,
        lastSeen: device.lastSeen || null,
        cloud: true
      }));
  }

  async sendFileToDevice(deviceId, sourcePath) {
    const status = this.connectionManager?.getStatus?.() || {};
    if (!this.connectionManager?.isConnected?.()) throw new Error('Cloud relay is not connected.');
    if (!status.device?.deviceId || !status.owner?.id) throw new Error('Cloud device is not registered.');
    const destinationDeviceId = String(deviceId || '').trim();
    if (!destinationDeviceId) throw new Error('Destination cloud device is required.');

    const resolvedPath = path.resolve(String(sourcePath || '').trim());
    const stats = await fs.promises.stat(resolvedPath);
    if (!stats.isFile()) throw new Error('Cloud transfer source must be a file.');
    const fileName = this.protocol.validateFileName(safeBaseName(resolvedPath));
    const fileSize = this.protocol.validateFileSize(stats.size);
    const sha256 = await this.hashFile(resolvedPath);
    const transferId = createId('cloud_transfer');
    const chunkCount = Math.max(1, Math.ceil(fileSize / this.chunkBytes));
    const fileHandle = await fs.promises.open(resolvedPath, 'r');
    const transfer = {
      transferId,
      direction: 'desktop-to-phone',
      sourceDeviceId: status.device.deviceId,
      destinationDeviceId,
      ownerId: status.owner.id,
      fileName,
      fileSize,
      sha256,
      sourcePath: resolvedPath,
      fileHandle,
      chunkCount,
      nextChunkIndex: 0,
      state: 'pending',
      startedAt: Date.now()
    };
    this.outgoing.set(transferId, transfer);
    transfer.timeout = this.createTimeout(transferId, 'outgoing');

    const metadataSent = this.sendControl(transfer, 'metadata', {
      transferId,
      fileName,
      fileSize,
      mimeType: 'application/octet-stream',
      sha256,
      checksum: sha256,
      chunkBytes: this.chunkBytes,
      chunkCount,
      protocolVersion: PROTOCOL_VERSION,
      createdAt: transfer.startedAt
    });
    if (!metadataSent) {
      this.cleanupOutgoing(transfer, 'relay-send-failed');
      throw new Error('Cloud relay could not send the transfer metadata.');
    }
    this.log('info', 'Transfer Started', { transferId, fileName, fileSize, direction: transfer.direction });
    return new Promise((resolve, reject) => {
      transfer.resolve = resolve;
      transfer.reject = reject;
    });
  }

  acceptTransfer(transferId) {
    const transfer = this.incoming.get(transferId);
    if (!transfer) return false;
    transfer.state = 'accepted';
    this.sendControl(transfer, 'accept', { transferId, nextChunkIndex: transfer.nextChunkIndex });
    this.emitProgress(transfer);
    this.log('info', 'Transfer Accepted', { transferId });
    return true;
  }

  rejectTransfer(transferId, reason = 'rejected') {
    const transfer = this.incoming.get(transferId);
    if (!transfer) return false;
    this.sendControl(transfer, 'reject', { transferId, reason });
    this.cleanupIncoming(transfer, reason);
    this.log('info', 'Transfer Rejected', { transferId, reason });
    return true;
  }

  pauseTransfer(transferId) {
    const transfer = this.outgoing.get(transferId) || this.incoming.get(transferId);
    if (!transfer) return false;
    transfer.paused = true;
    transfer.state = 'paused';
    this.sendControl(transfer, 'pause', { transferId });
    this.emitProgress(transfer);
    return true;
  }

  resumeTransfer(transferId) {
    const transfer = this.outgoing.get(transferId) || this.incoming.get(transferId);
    if (!transfer) return false;
    transfer.paused = false;
    transfer.state = 'resuming';
    this.sendControl(transfer, 'resume', { transferId, nextChunkIndex: transfer.nextChunkIndex || 0 });
    if (this.outgoing.has(transferId)) this.sendNextChunk(transfer);
    this.emitProgress(transfer);
    return true;
  }

  cancelTransfer(transferId, reason = 'cancelled') {
    const transfer = this.outgoing.get(transferId) || this.incoming.get(transferId);
    if (!transfer) return false;
    this.sendControl(transfer, 'cancel', { transferId, reason });
    if (this.outgoing.has(transferId)) this.cleanupOutgoing(transfer, reason);
    else this.cleanupIncoming(transfer, reason);
    this.log('info', 'Transfer Cancelled', { transferId, reason });
    return true;
  }

  handleRelayPacket(message) {
    const packet = message?.packet || {};
    const payload = packet.payload || {};
    if (payload.type !== 'cloud-file-transfer') return;
    const action = String(payload.action || '').trim();
    try {
      if (action === 'metadata') return this.handleMetadata(packet, payload);
      if (action === 'accept') return this.handleAccept(payload);
      if (action === 'reject') return this.handleReject(payload);
      if (action === 'chunk') return this.handleChunk(packet, payload);
      if (action === 'chunk-ack') return this.handleChunkAck(payload);
      if (action === 'complete') return this.handleComplete(payload);
      if (action === 'complete-ack') return this.handleCompleteAck(payload);
      if (action === 'cancel') return this.handleCancel(payload);
      if (action === 'pause') return this.handlePause(payload);
      if (action === 'resume') return this.handleResume(payload);
    } catch (error) {
      this.log('warn', 'Chunk Failure', {
        transferId: payload.transferId || null,
        action,
        error: error.message
      });
    }
  }

  async handleMetadata(packet, payload) {
    const transferId = this.protocol.validateTransferId(payload.transferId);
    if (this.incoming.has(transferId)) {
      this.sendError(packet, transferId, 'duplicate-transfer', 'Transfer already exists.');
      return;
    }
    const fileName = this.protocol.validateFileName(payload.fileName);
    const fileSize = this.protocol.validateFileSize(payload.fileSize);
    const sha256 = this.protocol.validateHash(payload.sha256 || payload.checksum);
    const chunkCount = this.protocol.validateChunkCount(payload.chunkCount);
    const destination = this.reserveDestination(fileName);
    const tempPath = path.join(this.getTempDirectory(), `.${fileName}.${process.pid}.${transferId}.part`);
    await fs.promises.mkdir(path.dirname(tempPath), { recursive: true });
    await fs.promises.writeFile(tempPath, Buffer.alloc(0), { flag: 'wx', mode: 0o600 });
    const transfer = {
      transferId,
      direction: 'phone-to-desktop',
      sourceDeviceId: packet.sourceDeviceId,
      destinationDeviceId: packet.destinationDeviceId,
      ownerId: packet.ownerId,
      fileName,
      fileSize,
      sha256,
      chunkCount,
      destination,
      tempPath,
      receivedBytes: 0,
      nextChunkIndex: 0,
      hash: crypto.createHash('sha256'),
      state: 'waiting-approval',
      startedAt: Date.now()
    };
    transfer.timeout = this.createTimeout(transferId, 'incoming');
    this.incoming.set(transferId, transfer);
    this.emit('incoming-transfer', this.publicTransfer(transfer));
    this.emitProgress(transfer);
  }

  handleAccept(payload) {
    const transfer = this.outgoing.get(payload.transferId);
    if (!transfer) return;
    transfer.state = 'uploading';
    transfer.nextChunkIndex = Number(payload.nextChunkIndex) || 0;
    this.log('info', 'Transfer Accepted', { transferId: transfer.transferId });
    void this.sendNextChunk(transfer);
  }

  handleReject(payload) {
    const transfer = this.outgoing.get(payload.transferId);
    if (!transfer) return;
    const error = new Error(payload.reason || 'Transfer rejected.');
    transfer.reject?.(error);
    this.cleanupOutgoing(transfer, 'rejected');
  }

  async handleChunk(packet, payload) {
    const transfer = this.incoming.get(payload.transferId);
    if (!transfer || transfer.state === 'waiting-approval' || transfer.paused) return;
    const chunkIndex = this.protocol.validateChunkIndex(payload.chunkIndex);
    if (chunkIndex !== transfer.nextChunkIndex) {
      this.sendError(transfer, transfer.transferId, 'chunk-missing', 'Unexpected chunk sequence.');
      return;
    }
    const chunk = this.protocol.decodeChunk(payload.data);
    const chunkHash = this.protocol.validateHash(payload.sha256 || payload.checksum);
    if (this.integrity.createHash(chunk) !== chunkHash) {
      this.sendError(transfer, transfer.transferId, 'checksum-failure', 'Chunk checksum failed.');
      this.cleanupIncoming(transfer, 'checksum-failure');
      return;
    }
    await fs.promises.appendFile(transfer.tempPath, chunk);
    transfer.hash.update(chunk);
    transfer.receivedBytes += chunk.length;
    transfer.nextChunkIndex += 1;
    transfer.state = 'downloading';
    this.refreshTimeout(transfer);
    this.sendControl(transfer, 'chunk-ack', {
      transferId: transfer.transferId,
      chunkIndex,
      receivedBytes: transfer.receivedBytes,
      nextChunkIndex: transfer.nextChunkIndex
    });
    this.emitProgress(transfer);
  }

  handleChunkAck(payload) {
    const transfer = this.outgoing.get(payload.transferId);
    if (!transfer || transfer.paused) return;
    transfer.nextChunkIndex = Math.max(transfer.nextChunkIndex, Number(payload.nextChunkIndex) || transfer.nextChunkIndex);
    this.emitProgress(transfer);
    void this.sendNextChunk(transfer);
  }

  async handleComplete(payload) {
    const transfer = this.incoming.get(payload.transferId);
    if (!transfer) return;
    if (transfer.receivedBytes !== transfer.fileSize || transfer.nextChunkIndex !== transfer.chunkCount) {
      this.sendError(transfer, transfer.transferId, 'incomplete-transfer', 'Incomplete file transfer.');
      this.cleanupIncoming(transfer, 'incomplete-transfer');
      return;
    }
    const actualHash = transfer.hash.digest('hex');
    if (actualHash !== transfer.sha256) {
      this.sendError(transfer, transfer.transferId, 'checksum-failure', 'File checksum failed.');
      this.cleanupIncoming(transfer, 'checksum-failure');
      return;
    }
    await fs.promises.rename(transfer.tempPath, transfer.destination);
    const record = this.recordTransfer(transfer, 'completed');
    this.sendControl(transfer, 'complete-ack', {
      transferId: transfer.transferId,
      status: 'completed',
      receivedBytes: transfer.receivedBytes
    });
    transfer.state = 'completed';
    this.emit('completed', { ...this.publicTransfer(transfer), record, filePath: transfer.destination });
    this.cleanupIncoming(transfer, 'completed', { keepRecord: true });
  }

  handleCompleteAck(payload) {
    const transfer = this.outgoing.get(payload.transferId);
    if (!transfer) return;
    transfer.state = 'completed';
    const record = this.recordTransfer(transfer, 'completed');
    transfer.resolve?.({ record });
    this.emit('completed', { ...this.publicTransfer(transfer), record });
    this.cleanupOutgoing(transfer, 'completed', { keepRecord: true });
  }

  handleCancel(payload) {
    const transfer = this.outgoing.get(payload.transferId) || this.incoming.get(payload.transferId);
    if (!transfer) return;
    if (this.outgoing.has(payload.transferId)) this.cleanupOutgoing(transfer, 'cancelled');
    else this.cleanupIncoming(transfer, 'cancelled');
  }

  handlePause(payload) {
    const transfer = this.outgoing.get(payload.transferId) || this.incoming.get(payload.transferId);
    if (!transfer) return;
    transfer.paused = true;
    transfer.state = 'paused';
    this.emitProgress(transfer);
  }

  handleResume(payload) {
    const transfer = this.outgoing.get(payload.transferId) || this.incoming.get(payload.transferId);
    if (!transfer) return;
    transfer.paused = false;
    transfer.state = 'resuming';
    if (this.outgoing.has(payload.transferId)) {
      transfer.nextChunkIndex = Number(payload.nextChunkIndex) || transfer.nextChunkIndex || 0;
      void this.sendNextChunk(transfer);
    }
    this.emitProgress(transfer);
  }

  async sendNextChunk(transfer) {
    if (!transfer || transfer.paused || transfer.sending || !this.outgoing.has(transfer.transferId)) return;
    if (transfer.nextChunkIndex >= transfer.chunkCount) {
      if (transfer && transfer.nextChunkIndex >= transfer.chunkCount) {
        this.sendControl(transfer, 'complete', {
          transferId: transfer.transferId,
          fileSize: transfer.fileSize,
          sha256: transfer.sha256
        });
        transfer.state = 'waiting-complete-ack';
        this.refreshTimeout(transfer);
        this.emitProgress(transfer);
      }
      return;
    }
    transfer.sending = true;
    try {
      const chunkIndex = transfer.nextChunkIndex;
      const start = chunkIndex * this.chunkBytes;
      const bytesToRead = Math.min(this.chunkBytes, Math.max(0, transfer.fileSize - start));
      const buffer = Buffer.alloc(bytesToRead);
      const { bytesRead } = bytesToRead > 0
        ? await transfer.fileHandle.read(buffer, 0, bytesToRead, start)
        : { bytesRead: 0 };
      const chunk = bytesRead === buffer.length ? buffer : buffer.subarray(0, bytesRead);
      const chunkHash = this.integrity.createHash(chunk);
      const chunkSent = this.sendControl(transfer, 'chunk', {
        transferId: transfer.transferId,
        chunkIndex,
        sequenceNumber: chunkIndex,
        chunkSize: chunk.length,
        totalChunks: transfer.chunkCount,
        data: chunk.toString('base64'),
        sha256: chunkHash,
        checksum: chunkHash,
        state: 'uploading'
      });
      if (!chunkSent) {
        this.cancelTransfer(transfer.transferId, 'relay-send-failed');
        return;
      }
      this.refreshTimeout(transfer);
    } catch (error) {
      this.log('warn', 'Chunk Read Failure', {
        transferId: transfer.transferId,
        error: error.message
      });
      this.cancelTransfer(transfer.transferId, 'chunk-read-failed');
    } finally {
      transfer.sending = false;
    }
  }

  sendControl(transfer, action, payload) {
    const packet = {
      packetId: createId('cloud_file_packet'),
      protocolVersion: PROTOCOL_VERSION,
      packetType: action.includes('error') ? 'error' : 'request',
      sourceDeviceId: transfer.destinationDeviceId === this.getLocalDeviceId()
        ? transfer.destinationDeviceId
        : transfer.sourceDeviceId,
      destinationDeviceId: transfer.destinationDeviceId === this.getLocalDeviceId()
        ? transfer.sourceDeviceId
        : transfer.destinationDeviceId,
      ownerId: transfer.ownerId,
      timestamp: Date.now(),
      requestId: `${transfer.transferId}:${action}:${payload.chunkIndex ?? ''}`,
      responseId: null,
      metadata: { feature: 'cloud-file-transfer', action },
      checksum: null,
      encryption: null,
      payload: {
        type: 'cloud-file-transfer',
        action,
        ...payload
      }
    };
    return this.connectionManager?.sendRelayPacket?.(packet) === true;
  }

  sendError(transferOrPacket, transferId, code, message) {
    const transfer = transferOrPacket.transferId ? transferOrPacket : {
      transferId,
      sourceDeviceId: transferOrPacket.destinationDeviceId,
      destinationDeviceId: transferOrPacket.sourceDeviceId,
      ownerId: transferOrPacket.ownerId
    };
    this.sendControl(transfer, 'error', { transferId, code, message });
  }

  reserveDestination(fileName) {
    const directory = this.getReceiveDirectory();
    fs.mkdirSync(directory, { recursive: true });
    const parsed = path.parse(fileName);
    let index = 0;
    let destination;
    do {
      const suffix = index === 0 ? '' : ` (${index})`;
      destination = path.join(directory, `${parsed.name}${suffix}${parsed.ext}`);
      index += 1;
    } while (fs.existsSync(destination));
    return destination;
  }

  getReceiveDirectory() {
    return this.receiveDirectory || path.join(process.cwd(), 'openx_data', 'cloud', 'received');
  }

  getTempDirectory() {
    return this.tempDirectory || path.join(process.cwd(), 'openx_data', 'runtime', 'cloud-transfer');
  }

  getLocalDeviceId() {
    return this.connectionManager?.getStatus?.().device?.deviceId || '';
  }

  createTimeout(transferId, direction) {
    const timeout = setTimeout(() => {
      const transfer = direction === 'incoming' ? this.incoming.get(transferId) : this.outgoing.get(transferId);
      if (!transfer) return;
      this.cancelTransfer(transferId, 'timed-out');
      this.emit('failed', { transferId, reason: 'timed-out' });
    }, this.timeoutMs);
    timeout.unref?.();
    return timeout;
  }

  refreshTimeout(transfer) {
    if (transfer.timeout) clearTimeout(transfer.timeout);
    transfer.timeout = this.createTimeout(transfer.transferId, this.incoming.has(transfer.transferId) ? 'incoming' : 'outgoing');
  }

  cleanupIncoming(transfer, reason, options = {}) {
    if (transfer.timeout) clearTimeout(transfer.timeout);
    this.incoming.delete(transfer.transferId);
    if (!options.keepRecord && transfer.tempPath) fs.promises.rm(transfer.tempPath, { force: true }).catch(() => {});
    if (!options.keepRecord && reason !== 'rejected') this.recordTransfer(transfer, 'failed');
  }

  cleanupOutgoing(transfer, reason, options = {}) {
    if (transfer.timeout) clearTimeout(transfer.timeout);
    this.outgoing.delete(transfer.transferId);
    if (transfer.fileHandle) {
      transfer.fileHandle.close().catch(() => {});
      transfer.fileHandle = null;
    }
    if (!options.keepRecord && reason !== 'rejected') this.recordTransfer(transfer, 'failed');
    if (reason !== 'completed' && reason !== 'rejected') transfer.reject?.(new Error(reason || 'Transfer failed.'));
  }

  async hashFile(filePath) {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    await new Promise((resolve, reject) => {
      stream.on('data', chunk => hash.update(chunk));
      stream.on('error', reject);
      stream.on('end', resolve);
    });
    return hash.digest('hex');
  }

  recordTransfer(transfer, status) {
    return {
      fileName: transfer.fileName,
      size: transfer.fileSize,
      status
    };
  }

  emitProgress(transfer) {
    const progress = this.publicTransfer(transfer);
    this.emit('progress', progress);
    return progress;
  }

  publicTransfer(transfer) {
    const transferredBytes = transfer.receivedBytes ?? Math.min((transfer.nextChunkIndex || 0) * this.chunkBytes, transfer.fileSize);
    return {
      transferId: transfer.transferId,
      direction: transfer.direction,
      state: transfer.state,
      fileName: transfer.fileName,
      fileSize: transfer.fileSize,
      transferredBytes,
      percent: transfer.fileSize > 0 ? Math.min(100, Math.round((transferredBytes / transfer.fileSize) * 100)) : 100,
      currentChunk: transfer.nextChunkIndex || 0,
      totalChunks: transfer.chunkCount,
      sourceDeviceId: transfer.sourceDeviceId,
      destinationDeviceId: transfer.destinationDeviceId
    };
  }

  handleRelayError(message) {
    this.log('warn', 'Relay Failure', {
      packetId: message?.packetId || null,
      requestId: message?.requestId || null,
      code: message?.code || 'relay-error'
    });
  }

  log(level, message, data = {}) {
    try {
      const target = typeof this.logger[level] === 'function' ? level : 'info';
      this.logger[target](`[CLOUD-FILE] ${message}`, data);
    } catch (_) {}
  }
}

module.exports = CloudFileTransferManager;
