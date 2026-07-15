const EventEmitter = require('events');
const CloudCommandRouter = require('./CloudCommandRouter');
const CloudRequestQueue = require('./CloudRequestQueue');
const CloudResponseSerializer = require('./CloudResponseSerializer');

const DEFAULT_EXECUTION_TIMEOUT_MS = 60000;
const MAX_COMMAND_LENGTH = 4000;

class CloudCommandManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.connectionManager = options.connectionManager;
    this.commandRouter = options.commandRouter || new CloudCommandRouter(options.assistantProvider);
    this.queue = options.queue || new CloudRequestQueue({
      mode: options.queueMode,
      maxQueueSize: options.maxQueueSize
    });
    this.serializer = options.serializer || new CloudResponseSerializer();
    this.scheduleProvider = typeof options.scheduleProvider === 'function' ? options.scheduleProvider : null;
    this.scheduleUpsertHandler = typeof options.scheduleUpsertHandler === 'function' ? options.scheduleUpsertHandler : null;
    this.permissionManager = options.permissionManager || null;
    this.executionTimeoutMs = Number.isFinite(options.executionTimeoutMs)
      ? Math.max(1000, Math.round(options.executionTimeoutMs))
      : DEFAULT_EXECUTION_TIMEOUT_MS;
    this.logger = options.logger || console;
    this.lifecycle = new Map();
    this.started = false;
    this.processing = false;
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

  stop() {
    if (!this.started || !this.connectionManager) return false;
    this.connectionManager.off('relay-packet', this.boundPacketHandler);
    this.connectionManager.off('relay-error', this.boundRelayErrorHandler);
    this.started = false;
    return true;
  }

  destroy() {
    this.stop();
    this.queue.clear();
    this.lifecycle.clear();
    this.removeAllListeners();
  }

  handleRelayPacket(message) {
    const packet = message?.packet || null;
    if (packet?.payload?.type === 'cloud-file-transfer' || packet?.metadata?.feature === 'cloud-file-transfer') {
      return { accepted: false, code: 'ignored-file-transfer' };
    }
    if (packet?.payload?.type === 'profile-sync') {
      return { accepted: false, code: 'ignored-profile-sync' };
    }
    const validation = this.validatePacket(packet);
    if (!validation.valid) {
      this.log('warn', 'Validation Failed', {
        packetId: packet?.packetId || null,
        requestId: packet?.requestId || null,
        code: validation.code
      });
      if (packet?.sourceDeviceId && packet?.destinationDeviceId && packet?.ownerId) {
        this.sendSerializedResponse(this.serializer.error(this.normalizeRequest(packet), validation.code, validation.message, {
          status: 'failed'
        }));
      }
      return { accepted: false, code: validation.code };
    }

    const request = validation.request;
    const permission = this.checkPermission(request);
    if (!permission.allowed) {
      this.log('warn', 'Permission Denied', {
        requestId: request.requestId,
        sourceDeviceId: request.sourceDeviceId,
        permissionName: permission.permissionName,
        reason: permission.reason
      });
      this.sendSerializedResponse(this.serializer.error(request, 'permission-denied', 'Permission denied.', {
        status: 'failed',
        permission
      }));
      return { accepted: false, code: 'permission-denied', permission };
    }
    this.lifecycle.set(request.requestId, {
      requestId: request.requestId,
      state: 'received',
      receivedAt: Date.now(),
      sourceDeviceId: request.sourceDeviceId,
      destinationDeviceId: request.destinationDeviceId
    });
    this.log('info', 'Request Received', {
      requestId: request.requestId,
      packetId: request.packetId,
      sourceDeviceId: request.sourceDeviceId,
      destinationDeviceId: request.destinationDeviceId
    });

    if (request.feature === 'schedule-sync') {
      this.executeScheduleSync(request);
      return { accepted: true, requestId: request.requestId };
    }

    const queued = this.queue.enqueue(request);
    if (!queued.accepted) {
      this.setLifecycle(request.requestId, queued.code);
      this.sendSerializedResponse(this.serializer.error(request, queued.code, queued.message, {
        status: 'failed'
      }));
      return queued;
    }

    this.setLifecycle(request.requestId, 'queued');
    this.processQueue();
    return { accepted: true, requestId: request.requestId };
  }

  validatePacket(packet) {
    if (!packet || typeof packet !== 'object') {
      return this.fail('malformed-request', 'Malformed cloud command packet.');
    }
    if (packet.packetType !== 'request') {
      return this.fail('unsupported-packet-type', 'Unsupported cloud command packet type.');
    }
    const status = this.connectionManager?.getStatus?.() || {};
    const desktopDevice = status.device || null;
    const owner = status.owner || null;
    if (!this.connectionManager?.isConnected?.()) {
      return this.fail('cloud-disconnected', 'Desktop cloud connection is not active.');
    }
    if (!desktopDevice?.deviceId || packet.destinationDeviceId !== desktopDevice.deviceId) {
      return this.fail('invalid-destination', 'Invalid destination device.');
    }
    if (!owner?.id || packet.ownerId !== owner.id) {
      return this.fail('owner-violation', 'Invalid owner.');
    }

    const payload = packet.payload && typeof packet.payload === 'object' ? packet.payload : {};
    const kind = String(payload.type || payload.kind || payload.feature || '').trim();
    if (kind === 'schedule-sync') {
      if (!packet.requestId) {
        return this.fail('missing-request-id', 'Request ID is required.');
      }
      const action = String(payload.action || payload.operation || 'request').trim().toLowerCase();
      if (!['request', 'upsert'].includes(action)) {
        return this.fail('unsupported-schedule-sync-action', 'Unsupported schedule sync action.');
      }
      return {
        valid: true,
        request: {
          ...this.normalizeRequest(packet),
          feature: 'schedule-sync',
          action,
          schedule: payload.schedule || payload.item || null,
          deviceName: String(payload.deviceName || payload.sourceDeviceName || packet.metadata?.deviceName || '').trim(),
          metadata: {
            ...(packet.metadata || {}),
            ...(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {})
          }
        }
      };
    }

    if (kind && kind !== 'assistant-command') {
      return this.fail('unsupported-request', 'Unsupported cloud request.');
    }
    const command = String(payload.command || payload.message || payload.text || '').trim();
    if (!command) {
      return this.fail('empty-command', 'Command is required.');
    }
    if (command.length > MAX_COMMAND_LENGTH) {
      return this.fail('command-too-large', 'Command is too large.');
    }
    if (!packet.requestId) {
      return this.fail('missing-request-id', 'Request ID is required.');
    }

    return {
      valid: true,
      request: {
        ...this.normalizeRequest(packet),
        feature: 'assistant-command',
        command,
        deviceName: String(payload.deviceName || payload.sourceDeviceName || packet.metadata?.deviceName || '').trim(),
        metadata: {
          ...(packet.metadata || {}),
          ...(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {})
        }
      }
    };
  }

  normalizeRequest(packet) {
    return {
      packetId: String(packet.packetId || ''),
      requestId: String(packet.requestId || packet.packetId || ''),
      sourceDeviceId: String(packet.sourceDeviceId || ''),
      destinationDeviceId: String(packet.destinationDeviceId || ''),
      ownerId: String(packet.ownerId || ''),
      timestamp: Number(packet.timestamp) || Date.now()
    };
  }

  async processQueue() {
    if (this.processing) return;
    this.processing = true;
    try {
      for (;;) {
        const request = this.queue.next();
        if (!request) break;
        await this.executeRequest(request);
      }
    } finally {
      this.processing = false;
    }
  }

  async executeRequest(request) {
    this.setLifecycle(request.requestId, 'executing');
    this.emit('assistant-command', {
      request,
      command: request.command,
      deviceName: request.deviceName || null,
      timestamp: Date.now()
    });
    this.log('info', 'Execution Started', {
      requestId: request.requestId,
      sourceDeviceId: request.sourceDeviceId
    });
    try {
      const result = await this.withTimeout(
        this.commandRouter.route(request.command, {
          permissionGuard: (intent, entities) => this.checkPermission({
            ...request,
            intent,
            entities,
            permissionName: 'remoteCommands'
          }),
          phoneContext: {
            deviceId: request.sourceDeviceId,
            deviceName: request.deviceName || null,
            ownerId: request.ownerId,
            cloud: true,
            cloudRequestId: request.requestId
          }
        }),
        this.executionTimeoutMs
      );
      this.setLifecycle(request.requestId, 'completed');
      this.queue.finish(true);
      this.sendSerializedResponse(this.serializer.serialize({
        request,
        result,
        status: 'completed',
        responseType: result?.needsClarification ? 'clarification' : 'assistant-response'
      }));
      this.emit('assistant-result', {
        request,
        result,
        status: 'completed',
        responseType: result?.needsClarification ? 'clarification' : 'assistant-response',
        timestamp: Date.now()
      });
      this.log('info', 'Execution Finished', {
        requestId: request.requestId,
        success: result?.success === true
      });
    } catch (error) {
      const timedOut = error?.code === 'execution-timeout';
      this.setLifecycle(request.requestId, timedOut ? 'timed-out' : 'failed');
      this.queue.finish(false);
      this.sendSerializedResponse(this.serializer.error(
        request,
        timedOut ? 'execution-timeout' : 'assistant-execution-failed',
        timedOut ? 'Execution Timed Out' : 'Assistant execution failed.',
        { status: timedOut ? 'timed-out' : 'failed' }
      ));
      this.emit('assistant-result', {
        request,
        result: {
          success: false,
          response: timedOut ? 'Execution timed out.' : 'Assistant execution failed.',
          message: timedOut ? 'Execution timed out.' : 'Assistant execution failed.',
          error: timedOut ? 'execution-timeout' : 'assistant-execution-failed'
        },
        status: timedOut ? 'timed-out' : 'failed',
        responseType: 'error',
        timestamp: Date.now()
      });
      this.log('warn', timedOut ? 'Timeout' : 'Execution Failed', {
        requestId: request.requestId,
        error: error?.message || String(error)
      });
    }
  }

  async executeScheduleSync(request) {
    this.setLifecycle(request.requestId, 'executing');
    try {
      if (request.action === 'upsert') {
        if (!this.scheduleUpsertHandler) {
          throw Object.assign(new Error('Schedule sync unavailable.'), { code: 'schedule-sync-unavailable' });
        }
        const result = await this.scheduleUpsertHandler(request.schedule || {}, {
          deviceId: request.sourceDeviceId,
          deviceName: request.deviceName || null,
          ownerId: request.ownerId,
          source: 'phone-cloud',
          cloudRequestId: request.requestId
        });
        if (result?.success !== true) {
          throw Object.assign(new Error(result?.error || 'Unable to sync schedule.'), { code: 'schedule-sync-failed' });
        }
      }

      const snapshot = this.scheduleProvider?.() || {
        version: 1,
        source: 'desktop',
        generatedAt: new Date().toISOString(),
        entries: []
      };
      this.setLifecycle(request.requestId, 'completed');
      this.sendSerializedResponse(this.serializer.serialize({
        request,
        result: {
          success: true,
          response: 'Schedules synced.',
          message: 'Schedules synced.',
          data: {
            scheduleSync: true,
            snapshot
          }
        },
        status: 'completed',
        responseType: 'schedule-sync'
      }));
    } catch (error) {
      this.setLifecycle(request.requestId, 'failed');
      this.sendSerializedResponse(this.serializer.error(
        request,
        error?.code || 'schedule-sync-failed',
        error?.message || 'Schedule sync failed.',
        { status: 'failed' }
      ));
    }
  }

  checkPermission(input = {}) {
    const feature = String(input.feature || '').trim();
    const permissionName = input.permissionName || (feature === 'schedule-sync' ? 'calendar' : 'remoteCommands');
    if (!this.permissionManager?.checkPermission) return { allowed: true, permissionName, reason: 'permission-manager-unavailable' };
    const result = this.permissionManager.checkPermission({
      deviceId: input.sourceDeviceId,
      permissionName,
      operation: feature || input.operation || permissionName,
      ownerId: input.ownerId,
      sourceDeviceId: input.sourceDeviceId,
      destinationDeviceId: input.destinationDeviceId
    });
    return { permissionName, ...result };
  }

  sendSerializedResponse(packet) {
    const sent = this.connectionManager?.sendRelayPacket?.(packet) === true;
    if (!sent) {
      this.log('warn', 'Relay Error', {
        requestId: packet?.requestId || null,
        responseId: packet?.responseId || null,
        code: 'send-failed'
      });
    }
    return sent;
  }

  handleRelayError(message) {
    this.log('warn', 'Relay Error', {
      packetId: message?.packetId || null,
      requestId: message?.requestId || null,
      code: message?.code || 'relay-error'
    });
  }

  withTimeout(promise, timeoutMs) {
    let timer = null;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error('Execution Timed Out');
        error.code = 'execution-timeout';
        reject(error);
      }, timeoutMs);
      timer.unref?.();
    });
    return Promise.race([promise, timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  setLifecycle(requestId, state) {
    const current = this.lifecycle.get(requestId) || { requestId };
    this.lifecycle.set(requestId, {
      ...current,
      state,
      updatedAt: Date.now()
    });
    this.emit('lifecycle', this.lifecycle.get(requestId));
  }

  getStatus() {
    return {
      started: this.started,
      processing: this.processing,
      executionTimeoutMs: this.executionTimeoutMs,
      queue: this.queue.getStatistics(),
      requests: [...this.lifecycle.values()].slice(-25)
    };
  }

  fail(code, message) {
    return { valid: false, code, message };
  }

  log(level, message, data = {}) {
    try {
      const target = typeof this.logger[level] === 'function' ? level : 'info';
      this.logger[target](`Cloud command ${message}`, data);
    } catch (_) {}
  }
}

module.exports = CloudCommandManager;
