'use strict';

function deepClone(value) {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(item => deepClone(item));
  const output = {};
  Object.keys(value).forEach(key => {
    output[key] = deepClone(value[key]);
  });
  return output;
}

module.exports = deepClone;
