'use strict';

const { WalletError } = require('./BlockchainErrors');

class SecureWalletStore {
  constructor(options = {}) {
    this.secretStore = options.secretStore || null;
    this.memoryPrivateKey = '';
  }

  async loadPrivateKey() {
    if (!this.secretStore) return this.memoryPrivateKey || '';
    try {
      return String(await this.secretStore.loadPrivateKey()) || '';
    } catch (error) {
      throw new WalletError('Unable to load secure blockchain wallet key.', {
        code: 'BLOCKCHAIN_WALLET_SECURE_LOAD_FAILED',
        cause: error
      });
    }
  }

  async savePrivateKey(privateKey) {
    const value = String(privateKey || '').trim();
    if (!value) {
      throw new WalletError('Blockchain private key is required for secure storage.', {
        code: 'BLOCKCHAIN_WALLET_PRIVATE_KEY_REQUIRED'
      });
    }
    if (!this.secretStore) {
      this.memoryPrivateKey = value;
      return true;
    }
    try {
      return await this.secretStore.savePrivateKey(value);
    } catch (error) {
      throw new WalletError('Unable to save secure blockchain wallet key.', {
        code: 'BLOCKCHAIN_WALLET_SECURE_SAVE_FAILED',
        cause: error
      });
    }
  }

  async deletePrivateKey() {
    this.memoryPrivateKey = '';
    if (!this.secretStore) return true;
    try {
      return await this.secretStore.deletePrivateKey();
    } catch (error) {
      throw new WalletError('Unable to delete secure blockchain wallet key.', {
        code: 'BLOCKCHAIN_WALLET_SECURE_DELETE_FAILED',
        cause: error
      });
    }
  }
}

module.exports = SecureWalletStore;
