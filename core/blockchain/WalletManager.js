'use strict';

const { ethers } = require('ethers');
const SecureWalletStore = require('./SecureWalletStore');
const { WalletError, WalletGenerationError } = require('./BlockchainErrors');

class WalletManager {
  constructor(options = {}) {
    this.client = options.client || null;
    this.logger = options.logger || console;
    this.WalletClass = options.WalletClass || ethers.Wallet;
    this.secureStore = options.secureStore || new SecureWalletStore(options.secureStoreOptions || {});
    this.wallet = null;
    this.address = '';
  }

  async ensureWallet() {
    const loaded = await this.loadStoredWallet();
    if (loaded.loaded) return loaded;
    return this.generateWallet();
  }

  async loadStoredWallet() {
    const privateKey = await this.secureStore.loadPrivateKey();
    return this.loadWallet({ privateKey });
  }

  async loadWallet(options = {}) {
    const privateKey = String(options.privateKey || '').trim();
    if (!privateKey) {
      this.wallet = null;
      this.address = '';
      return this.getStatus();
    }

    try {
      const provider = this.client?.getInternalProvider?.() || null;
      this.wallet = new this.WalletClass(privateKey, provider);
      this.address = await this.wallet.getAddress();
      return this.getStatus();
    } catch (error) {
      this.wallet = null;
      this.address = '';
      throw new WalletError('Unable to load blockchain wallet.', {
        code: 'BLOCKCHAIN_WALLET_LOAD_FAILED',
        cause: error
      });
    }
  }

  async generateWallet() {
    try {
      const wallet = this.WalletClass.createRandom
        ? this.WalletClass.createRandom()
        : ethers.Wallet.createRandom();
      await this.secureStore.savePrivateKey(wallet.privateKey);
      return this.loadWallet({ privateKey: wallet.privateKey });
    } catch (error) {
      this.wallet = null;
      this.address = '';
      throw new WalletGenerationError('Unable to generate blockchain wallet.', {
        code: 'BLOCKCHAIN_WALLET_GENERATION_FAILED',
        cause: error
      });
    }
  }

  async createWallet() {
    return this.generateWallet();
  }

  importWallet() {
    throw new WalletError('Wallet import is reserved for a future phase.', {
      code: 'BLOCKCHAIN_WALLET_IMPORT_NOT_IMPLEMENTED'
    });
  }

  rotateKey() {
    throw new WalletError('Wallet key rotation is reserved for a future phase.', {
      code: 'BLOCKCHAIN_WALLET_ROTATION_NOT_IMPLEMENTED'
    });
  }

  getWalletAccess() {
    return Object.freeze({
      isLoaded: () => Boolean(this.wallet),
      getAddress: () => this.address || null
    });
  }

  getSigner() {
    if (!this.wallet) {
      throw new WalletError('Blockchain wallet is not loaded.', {
        code: 'BLOCKCHAIN_WALLET_NOT_LOADED'
      });
    }
    return this.wallet;
  }

  getStatus() {
    return {
      loaded: Boolean(this.wallet),
      address: this.address || null,
      secureStorage: this.secureStore ? 'enabled' : 'unavailable'
    };
  }

  async shutdown() {
    this.wallet = null;
    this.address = '';
  }
}

module.exports = WalletManager;
