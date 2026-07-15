'use strict';

class BaseCandidateFilter {
  constructor({ id, logger = null } = {}) {
    this.id = id || this.constructor.name;
    this.logger = logger;
  }

  supports() {
    return true;
  }

  apply(pool) {
    return pool.applyFilter(this.id, () => true, { skipped: true });
  }
}

module.exports = BaseCandidateFilter;
