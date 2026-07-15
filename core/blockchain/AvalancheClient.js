'use strict';

const EventEmitter = require('events');
const { ethers } = require('ethers');
const BLOCKCHAIN_EVENTS = require('./BlockchainEvents');
const { BLOCKCHAIN_STATES } = require('./BlockchainConstants');
const {
  ConnectionError,
  ProviderError,
  RPCError,
  wrapBlockchainError
} = require('./BlockchainErrors');
const { withTimeout, retryOperation } = require('./utils/async');

class AvalancheClient extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = options.config || {};
    this.logger = options.logger || console;
    this.ProviderClass = options.ProviderClass || ethers.JsonRpcProvider;
    this.providerFactory = options.providerFactory || null;
    this.provider = null;
    this.state = BLOCKCHAIN_STATES.STOPPED;
    this.lastNetwork = null;
    this.lastBlockNumber = null;
    this.retryCount = 0;
  }

  async connect() {
    this.state = BLOCKCHAIN_STATES.CONNECTING;
    try {
      this.provider = this.createProvider();
      const network = await this.withRetry(() => this.withTimeout(
        this.provider.getNetwork(),
        this.config.connectionTimeoutMs,
        { operation: 'getNetwork' }
      ));
      this.lastNetwork = normalizeNetwork(network);
      this.state = BLOCKCHAIN_STATES.CONNECTED;
      this.emit(BLOCKCHAIN_EVENTS.CONNECTED, { network: this.lastNetwork });
      return this.getStatus();
    } catch (error) {
      this.state = BLOCKCHAIN_STATES.ERROR;
      const wrapped = wrapBlockchainError(error, ConnectionError, { network: this.config.network });
      this.emit(BLOCKCHAIN_EVENTS.ERROR, wrapped.toJSON());
      throw wrapped;
    }
  }

  async reconnect(reason = 'manual-reconnect') {
    await this.disconnect(reason);
    const status = await this.connect();
    this.emit(BLOCKCHAIN_EVENTS.RECONNECTED, { reason, status });
    return status;
  }

  async disconnect(reason = 'disconnect') {
    const provider = this.provider;
    this.provider = null;
    this.state = BLOCKCHAIN_STATES.DISCONNECTED;
    if (provider?.destroy) {
      try {
        await provider.destroy();
      } catch (error) {
        this.logger.warn?.('Provider destroy failed', { error: error.message });
      }
    } else {
      provider?.removeAllListeners?.();
    }
    this.emit(BLOCKCHAIN_EVENTS.DISCONNECTED, { reason });
    return this.getStatus();
  }

  createProvider() {
    if (this.providerFactory) return this.providerFactory(this.config);
    return new this.ProviderClass(this.config.rpcUrl, {
      name: this.config.networkName || this.config.network || 'avalanche',
      chainId: Number(this.config.chainId)
    }, {
      staticNetwork: true
    });
  }

  ensureProvider() {
    if (!this.provider) {
      throw new ProviderError('Avalanche provider is not connected.', {
        code: 'BLOCKCHAIN_PROVIDER_NOT_CONNECTED',
        details: { network: this.config.network }
      });
    }
    return this.provider;
  }

  async getNetwork() {
    try {
      const network = await this.withRetry(() => this.withTimeout(
        this.ensureProvider().getNetwork(),
        this.config.requestTimeoutMs,
        { operation: 'getNetwork' }
      ));
      const normalized = normalizeNetwork(network);
      const previousChainId = this.lastNetwork?.chainId;
      this.lastNetwork = normalized;
      if (previousChainId && previousChainId !== normalized.chainId) {
        this.emit(BLOCKCHAIN_EVENTS.NETWORK_CHANGED, { previousChainId, network: normalized });
      }
      return normalized;
    } catch (error) {
      throw wrapBlockchainError(error, RPCError, { method: 'getNetwork' });
    }
  }

  async getBlockNumber() {
    try {
      const blockNumber = await this.withRetry(() => this.withTimeout(
        this.ensureProvider().getBlockNumber(),
        this.config.requestTimeoutMs,
        { operation: 'getBlockNumber' }
      ));
      this.lastBlockNumber = Number(blockNumber);
      return this.lastBlockNumber;
    } catch (error) {
      throw wrapBlockchainError(error, RPCError, { method: 'getBlockNumber' });
    }
  }

  async getFeeData() {
    try {
      return await this.withRetry(() => this.withTimeout(
        this.ensureProvider().getFeeData(),
        this.config.requestTimeoutMs,
        { operation: 'getFeeData' }
      ));
    } catch (error) {
      throw wrapBlockchainError(error, RPCError, { method: 'getFeeData' });
    }
  }

  async call(method, params = []) {
    try {
      return await this.withRetry(() => this.withTimeout(
        this.ensureProvider().send(method, params),
        this.config.requestTimeoutMs,
        { operation: method }
      ));
    } catch (error) {
      throw wrapBlockchainError(error, RPCError, { method });
    }
  }

  getProviderAccess() {
    return Object.freeze({
      getNetwork: () => this.getNetwork(),
      getBlockNumber: () => this.getBlockNumber(),
      getFeeData: () => this.getFeeData(),
      call: (method, params) => this.call(method, params)
    });
  }

  getInternalProvider() {
    return this.ensureProvider();
  }

  withTimeout(promise, timeoutMs, details) {
    return withTimeout(promise, timeoutMs, details);
  }

  async withRetry(operation) {
    return retryOperation(async attempt => {
      if (attempt > 1) {
        this.retryCount += 1;
        this.emit('retry', { attempt, retryCount: this.retryCount });
      }
      return operation(attempt);
    }, this.config.retry || {});
  }

  getStatus() {
    return {
      state: this.state,
      connected: this.state === BLOCKCHAIN_STATES.CONNECTED,
      network: this.lastNetwork,
      lastBlock: this.lastBlockNumber,
      retryCount: this.retryCount
    };
  }
}

function normalizeNetwork(network = {}) {
  return {
    name: String(network.name || ''),
    chainId: Number(network.chainId)
  };
}

module.exports = AvalancheClient;
