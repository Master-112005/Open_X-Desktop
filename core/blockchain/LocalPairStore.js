'use strict';

const fs = require('fs');
const path = require('path');
const PairRecord = require('./PairRecord');
const { PairSynchronizationError } = require('./BlockchainErrors');

class LocalPairStore {
  constructor(options = {}) {
    this.filePath = options.filePath || null;
    this.memoryPairs = new Map();
  }

  async list() {
    if (!this.filePath) return [...this.memoryPairs.values()].map(pair => ({ ...pair }));
    try {
      if (!fs.existsSync(this.filePath)) return [];
      const raw = fs.readFileSync(this.filePath, 'utf8').trim();
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(pair => PairRecord.normalize(pair).toJSON()) : [];
    } catch (error) {
      throw new PairSynchronizationError('Unable to load blockchain pair records.', {
        code: 'BLOCKCHAIN_PAIR_LOAD_FAILED',
        cause: error
      });
    }
  }

  async get(pairId) {
    const id = String(pairId || '').trim();
    if (!id) return null;
    const pairs = await this.list();
    return pairs.find(pair => pair.pairId === id || pair.pairHash === id) || null;
  }

  async save(pair) {
    const normalized = PairRecord.normalize(pair).toJSON();
    if (!this.filePath) {
      this.memoryPairs.set(normalized.pairId, normalized);
      return normalized;
    }
    const pairs = await this.list();
    const index = pairs.findIndex(item => item.pairId === normalized.pairId);
    if (index >= 0) pairs[index] = normalized;
    else pairs.unshift(normalized);
    return this.saveAll(pairs.slice(0, 100));
  }

  async saveAll(pairs = []) {
    const normalized = pairs.map(pair => PairRecord.normalize(pair).toJSON());
    if (!this.filePath) {
      this.memoryPairs.clear();
      for (const pair of normalized) this.memoryPairs.set(pair.pairId, pair);
      return normalized[0] || null;
    }
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
      const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
      fs.renameSync(tempPath, this.filePath);
      try { fs.chmodSync(this.filePath, 0o600); } catch (_) {}
      return normalized[0] || null;
    } catch (error) {
      throw new PairSynchronizationError('Unable to save blockchain pair records.', {
        code: 'BLOCKCHAIN_PAIR_SAVE_FAILED',
        cause: error
      });
    }
  }
}

module.exports = LocalPairStore;
