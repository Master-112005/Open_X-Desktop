'use strict';

const { isPlainObject } = require('./ValidationHelpers');
const deepClone = require('./DeepClone');

function mergeDeep(base, override) {
  const output = isPlainObject(base) ? deepClone(base) : {};
  if (!isPlainObject(override)) return output;

  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(output[key])) {
      output[key] = mergeDeep(output[key], value);
    } else {
      output[key] = deepClone(value);
    }
  }
  return output;
}

class ConfigurationLoader {
  constructor(defaults = {}) {
    this.defaults = isPlainObject(defaults) ? deepClone(defaults) : {};
  }

  load(overrides = {}) {
    return mergeDeep(this.defaults, overrides);
  }
}

ConfigurationLoader.mergeDeep = mergeDeep;

module.exports = ConfigurationLoader;
