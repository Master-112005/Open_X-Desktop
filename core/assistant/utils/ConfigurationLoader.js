'use strict';

const { isPlainObject } = require('./ValidationHelpers');

class ConfigurationLoader {
  constructor(defaults = {}) {
    this.defaults = isPlainObject(defaults) ? { ...defaults } : {};
  }

  load(overrides = {}) {
    return {
      ...this.defaults,
      ...(isPlainObject(overrides) ? overrides : {})
    };
  }
}

module.exports = ConfigurationLoader;
