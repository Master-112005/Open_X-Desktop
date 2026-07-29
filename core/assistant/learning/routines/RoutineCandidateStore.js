'use strict';

class RoutineCandidateStore {
  constructor(options = {}) {
    this.limit = Math.max(10, Number(options.limit || 100));
    this.candidates = [];
  }

  add(candidate) {
    this.candidates.push({ ...candidate, recordedAt: candidate.recordedAt || new Date().toISOString() });
    if (this.candidates.length > this.limit) this.candidates.splice(0, this.candidates.length - this.limit);
    return candidate;
  }

  list() {
    return this.candidates.slice();
  }

  clear() {
    this.candidates = [];
  }
}

module.exports = RoutineCandidateStore;
