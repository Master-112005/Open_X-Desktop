'use strict';

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (seen.has(value)) return value;
  seen.add(value);
  Object.freeze(value);
  Object.keys(value).forEach(key => deepFreeze(value[key], seen));
  if (value instanceof Map) {
    for (const [key, item] of value.entries()) {
      deepFreeze(key, seen);
      deepFreeze(item, seen);
    }
  }
  if (value instanceof Set) {
    for (const item of value.values()) {
      deepFreeze(item, seen);
    }
  }
  return value;
}

module.exports = deepFreeze;
