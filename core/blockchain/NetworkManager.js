'use strict';

const EventEmitter = require('events');
const BLOCKCHAIN_EVENTS = require('./BlockchainEvents');
const { ConnectionError, RPCError, wrapBlockchainError } = require('./BlockchainErrors');

class NetworkManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.client = options.client;
    this.config = options.config || {};
    this.logger = options.logger || console;
    this.health = options.health || null;
    this.healthTimer = null;
    this.currentChain = null;
    this.connected = false;
    this.lastLatencyMs = null;
  }

  async detectNetwork() {
    const startedAt = Date.now();
    try {
      const network = await this.client.getNetwork();
      this.lastLatencyMs = Math.max(0, Date.now() - startedAt);
      this.currentChain = network;
      this.connected = true;
      this.validateChain(network);
      this.health?.recordHealth?.({
        connected: true,
        healthy: true,
        latencyMs: this.lastLatencyMs,
        lastSyncAt: new Date().toISOString()
      });
      return {
        connected: true,
        network,
        latencyMs: this.lastLatencyMs
      };
    } catch (error) {
      this.connected = false;
      const wrapped = wrapBlockchainError(error, ConnectionError, { expectedChainId: this.config.chainId });
      this.health?.recordHealth?.({ connected: false, healthy: false, error: wrapped.message });
      this.emit(BLOCKCHAIN_EVENTS.ERROR, wrapped.toJSON());
      throw wrapped;
    }
  }

  validateChain(network = {}) {
    const expected = Number(this.config.chainId);
    const actual = Number(network.chainId);
    if (actual !== expected) {
      throw new RPCError('Connected blockchain chain ID does not match configuration.', {
        code: 'BLOCKCHAIN_CHAIN_MISMATCH',
        details: { expectedChainId: expected, actualChainId: actual }
      });
    }
    return true;
  }

  async validateRPC() {
    return this.detectNetwork();
  }

  async measureLatency() {
    const startedAt = Date.now();
    await this.client.getBlockNumber();
    this.lastLatencyMs = Math.max(0, Date.now() - startedAt);
    return this.lastLatencyMs;
  }

  async healthCheck() {
    try {
      const [network, blockNumber] = await Promise.all([
        this.client.getNetwork(),
        this.client.getBlockNumber()
      ]);
      this.validateChain(network);
      const latencyMs = await this.measureLatency();
      this.currentChain = network;
      this.connected = true;
      const snapshot = this.health?.recordHealth?.({
        connected: true,
        healthy: true,
        latencyMs,
        blockNumber,
        lastSyncAt: new Date().toISOString()
      }) || { connected: true, healthy: true, latencyMs, lastBlock: blockNumber };
      this.emit(BLOCKCHAIN_EVENTS.HEALTH_CHANGED, snapshot);
      return snapshot;
    } catch (error) {
      this.connected = false;
      const wrapped = wrapBlockchainError(error, RPCError, { operation: 'healthCheck' });
      const snapshot = this.health?.recordHealth?.({
        connected: false,
        healthy: false,
        error: wrapped.message
      }) || { connected: false, healthy: false, lastError: wrapped.message };
      this.emit(BLOCKCHAIN_EVENTS.HEALTH_CHANGED, snapshot);
      this.emit(BLOCKCHAIN_EVENTS.ERROR, wrapped.toJSON());
      return snapshot;
    }
  }

  startHealthMonitoring() {
    this.stopHealthMonitoring();
    this.healthTimer = setInterval(() => {
      this.healthCheck().catch(error => {
        this.logger.warn?.('Blockchain health monitoring failed', { error: error.message });
      });
    }, this.config.healthIntervalMs);
    this.healthTimer.unref?.();
  }

  stopHealthMonitoring() {
    if (this.healthTimer) clearInterval(this.healthTimer);
    this.healthTimer = null;
  }

  getStatus() {
    return {
      connected: this.connected,
      currentChain: this.currentChain,
      latencyMs: this.lastLatencyMs
    };
  }

  async shutdown() {
    this.stopHealthMonitoring();
    this.removeAllListeners();
  }
}

module.exports = NetworkManager;
