'use strict';

const DEFAULT_PREFIX = 'id';

class IdGenerator {
  constructor(options = {}) {
    this.prefix = String(options.prefix || DEFAULT_PREFIX).replace(/[^a-z0-9_-]/gi, '').toLowerCase() || DEFAULT_PREFIX;
    this.random = typeof options.random === 'function' ? options.random : Math.random;
    this.now = typeof options.now === 'function' ? options.now : Date.now;
  }

  next(prefix = this.prefix) {
    const safePrefix = String(prefix || this.prefix).replace(/[^a-z0-9_-]/gi, '').toLowerCase() || DEFAULT_PREFIX;
    const time = this.now().toString(36);
    const entropy = this.random().toString(36).slice(2, 10);
    return `${safePrefix}_${time}_${entropy}`;
  }
}

module.exports = IdGenerator;
