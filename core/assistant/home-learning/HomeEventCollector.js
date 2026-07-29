'use strict';

const HomeEventNormalizer = require('./HomeEventNormalizer');
const HomeEventValidator = require('./HomeEventValidator');

class HomeEventCollector {
  constructor(options = {}) {
    this.normalizer = options.normalizer || new HomeEventNormalizer();
    this.validator = options.validator || new HomeEventValidator();
  }

  collect(event = {}) {
    const normalized = this.normalizer.normalize(event);
    if (!normalized) return { valid: false, reason: 'Home event could not be normalized.' };
    const checked = this.validator.validate(normalized);
    return checked.valid ? { valid: true, event: normalized } : checked;
  }
}

module.exports = HomeEventCollector;
