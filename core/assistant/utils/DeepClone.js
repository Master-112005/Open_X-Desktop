'use strict';

function deepClone(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (Buffer.isBuffer?.(value)) return Buffer.from(value);
  if (seen.has(value)) return seen.get(value);
  if (Array.isArray(value)) {
    const output = [];
    seen.set(value, output);
    value.forEach(item => output.push(deepClone(item, seen)));
    return output;
  }
  if (value instanceof Map) {
    const output = new Map();
    seen.set(value, output);
    for (const [key, item] of value.entries()) {
      output.set(deepClone(key, seen), deepClone(item, seen));
    }
    return output;
  }
  if (value instanceof Set) {
    const output = new Set();
    seen.set(value, output);
    for (const item of value.values()) {
      output.add(deepClone(item, seen));
    }
    return output;
  }
  const output = {};
  seen.set(value, output);
  Object.keys(value).forEach(key => {
    output[key] = deepClone(value[key], seen);
  });
  return output;
}

module.exports = deepClone;
