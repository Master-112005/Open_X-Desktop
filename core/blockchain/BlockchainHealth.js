'use strict';

class BlockchainHealth {
  constructor(options = {}) {
    this.now = options.now || (() => Date.now());
    this.startedAt = 0;
    this.connected = false;
    this.healthy = false;
    this.latencyMs = null;
    this.lastBlockNumber = null;
    this.lastSyncAt = null;
    this.retryCounter = 0;
    this.lastError = '';
  }

  start() {
    this.startedAt = this.startedAt || this.now();
    return this.snapshot();
  }

  stop() {
    this.connected = false;
    this.healthy = false;
    return this.snapshot();
  }

  recordConnection(connected) {
    this.connected = Boolean(connected);
    if (!connected) this.healthy = false;
    return this.snapshot();
  }

  recordHealth(update = {}) {
    if (Object.prototype.hasOwnProperty.call(update, 'connected')) this.connected = Boolean(update.connected);
    if (Object.prototype.hasOwnProperty.call(update, 'healthy')) this.healthy = Boolean(update.healthy);
    if (Number.isFinite(Number(update.latencyMs))) this.latencyMs = Number(update.latencyMs);
    if (Number.isFinite(Number(update.blockNumber))) this.lastBlockNumber = Number(update.blockNumber);
    if (update.lastSyncAt) this.lastSyncAt = update.lastSyncAt;
    if (update.error) this.lastError = String(update.error);
    if (!update.error) this.lastError = '';
    return this.snapshot();
  }

  recordRetry() {
    this.retryCounter += 1;
    return this.retryCounter;
  }

  resetRetries() {
    this.retryCounter = 0;
  }

  isConnected() {
    return this.connected;
  }

  isHealthy() {
    return this.connected && this.healthy;
  }

  latency() {
    return this.latencyMs;
  }

  lastBlock() {
    return this.lastBlockNumber;
  }

  lastSync() {
    return this.lastSyncAt;
  }

  retryCount() {
    return this.retryCounter;
  }

  uptime() {
    return this.startedAt ? Math.max(0, this.now() - this.startedAt) : 0;
  }

  snapshot() {
    return {
      connected: this.isConnected(),
      healthy: this.isHealthy(),
      latencyMs: this.latency(),
      lastBlock: this.lastBlock(),
      lastSync: this.lastSync(),
      retryCount: this.retryCount(),
      uptimeMs: this.uptime(),
      lastError: this.lastError
    };
  }
}

module.exports = BlockchainHealth;
