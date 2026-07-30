const { createPendingRequest } = require('../models/PendingRequest');

class HomeAutomationState {
  constructor(options = {}) {
    this.maxPendingRequests = Number.isSafeInteger(Number(options.maxPendingRequests))
      ? Math.max(10, Math.min(1000, Number(options.maxPendingRequests)))
      : 200;
    this.pendingRequests = new Map();
    this.deviceCache = new Map();
  }

  addPendingRequest(packet, command) {
    this.pruneExpired();
    const pending = createPendingRequest({
      requestId: packet.requestId,
      packet,
      command,
      status: 'pending',
      expiresAt: packet.expiresAt
    });
    this.pendingRequests.set(pending.requestId, pending);
    while (this.pendingRequests.size > this.maxPendingRequests) {
      this.pendingRequests.delete(this.pendingRequests.keys().next().value);
    }
    return pending;
  }

  getPendingRequest(requestId) {
    this.pruneExpired();
    return this.pendingRequests.get(String(requestId || '').trim()) || null;
  }

  completePendingRequest(requestId) {
    const key = String(requestId || '').trim();
    const pending = this.pendingRequests.get(key) || null;
    if (pending) {
      this.pendingRequests.delete(key);
    }
    return pending;
  }

  listPendingRequests() {
    this.pruneExpired();
    return Array.from(this.pendingRequests.values());
  }

  listDevices() {
    return Array.from(this.deviceCache.values());
  }

  pruneExpired(nowMs = Date.now()) {
    for (const [requestId, pending] of this.pendingRequests.entries()) {
      const expiresAt = Date.parse(pending.expiresAt || '');
      if (Number.isFinite(expiresAt) && expiresAt <= nowMs) {
        this.pendingRequests.delete(requestId);
      }
    }
  }
}

module.exports = HomeAutomationState;
