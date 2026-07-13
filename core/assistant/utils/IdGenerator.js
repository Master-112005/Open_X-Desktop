'use strict';

const crypto = require('crypto');

const DEFAULT_PREFIX = 'id';

class IdGenerator {
  constructor(options = {}) {
    this.prefix = String(options.prefix || DEFAULT_PREFIX).replace(/[^a-z0-9_-]/gi, '').toLowerCase() || DEFAULT_PREFIX;
    this.random = typeof options.random === 'function' ? options.random : Math.random;
    this.now = typeof options.now === 'function' ? options.now : Date.now;
    this.counter = 0;
  }

  next(prefix = this.prefix) {
    const safePrefix = String(prefix || this.prefix).replace(/[^a-z0-9_-]/gi, '').toLowerCase() || DEFAULT_PREFIX;
    const time = this.now().toString(36);
    const counter = (this.counter = (this.counter + 1) % 1679616).toString(36).padStart(4, '0');
    const entropy = this._entropy();
    return `${safePrefix}_${time}_${counter}_${entropy}`;
  }

  _entropy() {
    if (crypto.randomBytes) {
      return crypto.randomBytes(4).toString('hex');
    }
    return this.random().toString(36).slice(2, 10).padEnd(8, '0').slice(0, 8);
  }
}

module.exports = IdGenerator;
