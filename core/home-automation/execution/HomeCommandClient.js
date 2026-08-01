'use strict';

const crypto = require('crypto');

const PROTOCOL_VERSION = 'openx-home-v1';
const RESULT_TYPES = new Set(['home:command-result', 'home:error']);
const ACCEPT_TYPE = 'home:command-accepted';

/**
 * Sends a real home:device-command packet over the already-connected relay
 * WebSocket and resolves once the target device (or the server, on its
 * behalf) reports a matching home:command-result or home:error - never
 * before that, so callers only ever see a genuine outcome.
 */
class HomeCommandClient {
  constructor(options = {}) {
    this.sendPacket = options.sendPacket;
    this.subscribe = options.subscribe;
    this.isConnected = options.isConnected || (() => true);
    this.now = options.now || (() => Date.now());
    this.timeoutMs = Number(options.timeoutMs) || 4500;
    this.pending = new Map();
    this.unsubscribe = typeof this.subscribe === 'function'
      ? this.subscribe(packet => this._handlePacket(packet))
      : null;
  }

  _handlePacket(packet) {
    const type = String(packet?.type || '');
    const requestId = [
      packet?.requestId,
      packet?.originalRequestId,
      packet?.commandRequestId,
      packet?.responseTo
    ].map(value => String(value || '').trim()).find(value => value && this.pending.has(value)) || '';
    const entry = requestId && this.pending.get(requestId);
    if (!entry) return;
    if (type === ACCEPT_TYPE) {
      entry.acknowledged = true;
      return;
    }
    if (!RESULT_TYPES.has(type)) return;
    this.pending.delete(requestId);
    clearTimeout(entry.timer);
    if (type === 'home:error') {
      entry.resolve({ success: false, code: packet.code || 'home-command-error', message: packet.message || 'The Home Device reported an error.' });
      return;
    }
    entry.resolve({
      success: packet.status === 'success',
      status: packet.status,
      result: packet.result || null,
      code: packet.status === 'success' ? null : (packet.result?.errorCode || 'home-command-failed'),
      message: packet.result?.message || (packet.status === 'success' ? null : 'The Home Device could not run that command.')
    });
  }

  sendCommand({ deviceId, ownerId, action, target = '', value = null }) {
    if (typeof this.sendPacket !== 'function' || !this.isConnected()) {
      return Promise.resolve({ success: false, code: 'home-command-unavailable', message: 'Not connected to OpenX_Server right now.' });
    }
    const requestId = `home_cmd_${this.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const packet = {
      type: 'home:device-command',
      requestId,
      timestamp: new Date(this.now()).toISOString(),
      protocolVersion: PROTOCOL_VERSION,
      ownerId: String(ownerId || ''),
      targetDeviceId: String(deviceId || ''),
      command: { action: String(action || ''), target: String(target || ''), value }
    };
    return new Promise(resolve => {
      const entry = { resolve, acknowledged: false, timer: null };
      entry.timer = setTimeout(() => {
        this.pending.delete(requestId);
        resolve(entry.acknowledged
          ? { success: false, code: 'home-command-timeout', message: 'The Home Device accepted the command but never confirmed it finished.' }
          : { success: false, code: 'home-command-timeout', message: 'OpenX_Server accepted the request but the Home Device never responded - it may be offline.' });
      }, this.timeoutMs);
      entry.timer.unref?.();
      this.pending.set(requestId, entry);
      const sent = this.sendPacket(packet);
      if (!sent) {
        this.pending.delete(requestId);
        clearTimeout(entry.timer);
        resolve({ success: false, code: 'home-command-send-failed', message: 'Could not reach OpenX_Server to send the command.' });
      }
    });
  }

  dispose() {
    for (const entry of this.pending.values()) clearTimeout(entry.timer);
    this.pending.clear();
    if (typeof this.unsubscribe === 'function') this.unsubscribe();
  }
}

module.exports = HomeCommandClient;
