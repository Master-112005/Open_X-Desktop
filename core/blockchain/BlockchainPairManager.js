'use strict';

const crypto = require('crypto');
const EventEmitter = require('events');
const PairRecord = require('./PairRecord');
const PairRegistryClient = require('./contracts/PairRegistryClient');
const BLOCKCHAIN_EVENTS = require('./BlockchainEvents');
const { PAIR_STATUS, PAIR_VERSION, PAIR_TOKEN_BYTES, PAIR_NONCE_BYTES } = require('./PairConstants');
const {
  PairError,
  PairExpiredError,
  PairRejectedError,
  PairVerificationError,
  BlockchainMismatchError,
  wrapBlockchainError
} = require('./BlockchainErrors');

class BlockchainPairManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = options.config || {};
    this.pairConfig = this.config.pairing || {};
    this.identityManager = options.identityManager || null;
    this.walletManager = options.walletManager || null;
    this.pairStore = options.pairStore || null;
    this.registryClient = options.registryClient || new PairRegistryClient({
      address: this.pairConfig.registryAddress,
      client: options.client
    });
    this.logger = options.logger || console;
    this.now = options.now || (() => Date.now());
    this.cache = new Map();
  }

  async createPair(options = {}) {
    const identity = await this.identityManager.getIdentity();
    const token = options.pairToken || generatePairToken();
    const createdAtMs = this.now();
    const expiresAtMs = createdAtMs + (Number(options.ttlMs) || Number(this.pairConfig.pairLifetimeMs) || 5 * 60 * 1000);
    const nonce = options.nonce || randomHex(PAIR_NONCE_BYTES);
    const pairHash = createPairHash({
      pairToken: token,
      desktopDeviceId: identity.deviceId,
      desktopWallet: identity.walletAddress,
      createdAt: createdAtMs,
      nonce
    });
    const pair = new PairRecord({
      pairId: pairHash.slice(2, 18),
      pairHash,
      desktopDeviceId: identity.deviceId,
      desktopWallet: identity.walletAddress,
      status: this.registryClient.isConfigured() ? PAIR_STATUS.PENDING : PAIR_STATUS.WAITING_APPROVAL,
      createdAt: new Date(createdAtMs).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
      version: PAIR_VERSION,
      network: this.config.network,
      nonce
    });

    let persisted = await this.persist(pair);
    if (this.registryClient.isConfigured()) {
      try {
        const result = await this.registryClient.createPair(pair, this.walletManager.getSigner());
        persisted = await this.persist(pair.with({
          status: PAIR_STATUS.WAITING_APPROVAL,
          transactionHash: result.transactionHash,
          blockNumber: result.blockNumber
        }));
      } catch (error) {
        persisted = await this.persist(pair.with({ status: PAIR_STATUS.FAILED }));
        const wrapped = wrapBlockchainError(error, PairError, { pairId: pair.pairId });
        this.emit(BLOCKCHAIN_EVENTS.PAIR_FAILED, wrapped.toJSON());
        throw wrapped;
      }
    }

    this.emit(BLOCKCHAIN_EVENTS.PAIR_CREATED, persisted.toJSON());
    this.emit(BLOCKCHAIN_EVENTS.PAIR_PENDING, persisted.toJSON());
    return {
      pair: persisted.toJSON(),
      pairToken: token,
      qr: this.buildQrTrustPayload(persisted, token)
    };
  }

  buildQrTrustPayload(pair, pairToken) {
    return {
      pv: PAIR_VERSION,
      pid: pair.pairId,
      ph: pair.pairHash,
      dd: pair.desktopDeviceId,
      dw: pair.desktopWallet,
      n: pair.nonce,
      ca: Date.parse(pair.createdAt),
      e: Date.parse(pair.expiresAt),
      bn: this.config.network,
      cid: this.config.chainId,
      pr: this.pairConfig.registryAddress || '',
      t: pairToken
    };
  }

  async verifyPair(payload = {}) {
    const pairToken = String(payload.pairToken || payload.t || '').trim();
    const pairHash = String(payload.pairHash || payload.ph || '').trim();
    const desktopDeviceId = String(payload.desktopDeviceId || payload.dd || '').trim();
    const desktopWallet = String(payload.desktopWallet || payload.dw || '').trim();
    const createdAt = Number(payload.createdAt || payload.ca || 0);
    const expiresAt = Number(payload.expiresAt || payload.e || 0);
    const nonce = String(payload.nonce || payload.n || '').trim();
    const network = String(payload.network || payload.bn || '').trim();

    if (expiresAt <= this.now()) throw new PairExpiredError('Blockchain pair request expired.', { code: 'BLOCKCHAIN_PAIR_EXPIRED' });
    if (network && network !== this.config.network) {
      throw new BlockchainMismatchError('Pair request network does not match this client.', {
        code: 'BLOCKCHAIN_PAIR_NETWORK_MISMATCH',
        details: { expected: this.config.network, actual: network }
      });
    }
    const computed = createPairHash({ pairToken, desktopDeviceId, desktopWallet, createdAt, nonce });
    if (computed !== pairHash) {
      throw new PairVerificationError('Pair hash verification failed.', {
        code: 'BLOCKCHAIN_PAIR_HASH_MISMATCH',
        details: { desktopDeviceId }
      });
    }
    if (this.registryClient.isConfigured()) {
      const exists = await this.registryClient.pairExists(pairHash);
      if (!exists) {
        throw new PairVerificationError('Pair request was not found on blockchain.', {
          code: 'BLOCKCHAIN_PAIR_NOT_FOUND'
        });
      }
      const chainPair = await this.registryClient.getPair(pairHash);
      if (chainPair.desktopDeviceId !== desktopDeviceId || String(chainPair.desktopWallet).toLowerCase() !== desktopWallet.toLowerCase()) {
        throw new PairVerificationError('Blockchain pair request does not match QR payload.', {
          code: 'BLOCKCHAIN_PAIR_QR_MISMATCH'
        });
      }
    }
    const result = { valid: true, pairHash, desktopDeviceId, desktopWallet, expiresAt };
    this.emit(BLOCKCHAIN_EVENTS.PAIR_VERIFIED, result);
    return result;
  }

  async approvePair(input = {}) {
    await this.verifyPair(input);
    const phoneIdentity = await this.identityManager.getIdentity();
    let pair = PairRecord.normalize({
      pairId: String(input.pairId || input.pid || input.pairHash || input.ph || '').replace(/^0x/, '').slice(0, 16),
      pairHash: input.pairHash || input.ph,
      desktopDeviceId: input.desktopDeviceId || input.dd,
      desktopWallet: input.desktopWallet || input.dw,
      phoneDeviceId: phoneIdentity.deviceId,
      phoneWallet: phoneIdentity.walletAddress,
      status: PAIR_STATUS.APPROVED,
      createdAt: Number(input.createdAt || input.ca),
      approvedAt: new Date(this.now()).toISOString(),
      expiresAt: Number(input.expiresAt || input.e),
      version: PAIR_VERSION,
      network: this.config.network,
      nonce: input.nonce || input.n
    });
    if (this.registryClient.isConfigured()) {
      const result = await this.registryClient.approvePair(pair, this.walletManager.getSigner());
      pair = pair.with({ transactionHash: result.transactionHash, blockNumber: result.blockNumber });
    }
    pair = await this.persist(pair);
    this.emit(BLOCKCHAIN_EVENTS.PAIR_APPROVED, pair.toJSON());
    return pair.toJSON();
  }

  async rejectPair(pairHash) {
    const pair = await this.updatePairStatus(pairHash, PAIR_STATUS.REJECTED, 'rejectPair');
    this.emit(BLOCKCHAIN_EVENTS.PAIR_REJECTED, pair.toJSON());
    throw new PairRejectedError('Blockchain pair request rejected.', { code: 'BLOCKCHAIN_PAIR_REJECTED' });
  }

  async revokePair(pairHash) {
    const pair = await this.updatePairStatus(pairHash, PAIR_STATUS.REVOKED, 'revokePair');
    this.emit(BLOCKCHAIN_EVENTS.PAIR_REVOKED, pair.toJSON());
    return pair.toJSON();
  }

  async updatePairStatus(pairHash, status, method) {
    const existing = PairRecord.normalize(await this.getPair(pairHash));
    let result = {};
    if (this.registryClient.isConfigured()) {
      result = await this.registryClient[method](existing.pairHash || pairHash, this.walletManager.getSigner());
    }
    return this.persist(existing.with({
      status,
      transactionHash: result.transactionHash || existing.transactionHash,
      blockNumber: result.blockNumber ?? existing.blockNumber
    }));
  }

  async pairExists(pairHash) {
    if (this.registryClient.isConfigured()) return this.registryClient.pairExists(pairHash);
    return Boolean(await this.pairStore?.get?.(pairHash));
  }

  async getPair(pairHash) {
    const id = String(pairHash || '').trim();
    const local = this.cache.get(id) || await this.pairStore?.get?.(id);
    if (local) return local;
    if (this.registryClient.isConfigured()) return this.registryClient.getPair(id);
    return null;
  }

  async refreshPair(pairHash) {
    if (!this.registryClient.isConfigured()) return this.getPair(pairHash);
    const chainPair = await this.registryClient.getPair(pairHash);
    const local = PairRecord.normalize(await this.getPair(pairHash));
    const refreshed = await this.persist(local.with(chainPair));
    this.emit(BLOCKCHAIN_EVENTS.PAIR_SYNCED, refreshed.toJSON());
    return refreshed.toJSON();
  }

  async synchronize() {
    const pairs = await this.pairStore?.list?.() || [];
    const now = this.now();
    for (const item of pairs) {
      const pair = PairRecord.normalize(item);
      if ([PAIR_STATUS.PENDING, PAIR_STATUS.WAITING_APPROVAL].includes(pair.status) && pair.isExpired(now)) {
        const expired = await this.persist(pair.with({ status: PAIR_STATUS.EXPIRED }));
        this.emit(BLOCKCHAIN_EVENTS.PAIR_EXPIRED, expired.toJSON());
      }
    }
    return this.pairStore?.list?.() || [];
  }

  async persist(pair) {
    const normalized = PairRecord.normalize(pair);
    this.cache.set(normalized.pairId, normalized.toJSON());
    this.cache.set(normalized.pairHash, normalized.toJSON());
    await this.pairStore?.save?.(normalized.toJSON());
    return normalized;
  }

  getStatus() {
    return {
      registryConfigured: this.registryClient.isConfigured(),
      cachedPairs: this.cache.size
    };
  }

  async shutdown() {
    this.removeAllListeners();
    this.cache.clear();
  }
}

function generatePairToken() {
  return randomHex(PAIR_TOKEN_BYTES);
}

function randomHex(bytes) {
  return `0x${crypto.randomBytes(bytes).toString('hex')}`;
}

function createPairHash(input = {}) {
  const payload = [
    String(input.pairToken || ''),
    String(input.desktopDeviceId || ''),
    String(input.desktopWallet || '').toLowerCase(),
    String(Number(input.createdAt || 0)),
    String(input.nonce || '')
  ].join('|');
  return `0x${crypto.createHash('sha256').update(payload).digest('hex')}`;
}

BlockchainPairManager.createPairHash = createPairHash;
BlockchainPairManager.generatePairToken = generatePairToken;

module.exports = BlockchainPairManager;
