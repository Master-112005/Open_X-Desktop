'use strict';

class PatternCandidateStore {
  constructor(options = {}) {
    this.limit = Math.max(20, Number(options.limit || 200));
    this.items = [];
  }

  add(item) {
    const record = { ...item, recordedAt: item.recordedAt || new Date().toISOString() };
    this.items.push(record);
    if (this.items.length > this.limit) this.items.splice(0, this.items.length - this.limit);
    return record;
  }

  list() {
    return this.items.slice();
  }
}

module.exports = PatternCandidateStore;
