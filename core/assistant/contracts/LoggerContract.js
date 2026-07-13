'use strict';

const methods = Object.freeze(['debug', 'info', 'warn', 'error']);

function validate(logger = {}) {
  const missing = methods.filter(method => typeof logger?.[method] !== 'function');
  return Object.freeze({
    valid: missing.length === 0,
    missing,
    methods
  });
}

module.exports = Object.freeze({
  name: 'LoggerContract',
  version: '1.1.0',
  methods,
  required: methods,
  hasMethod: method => methods.includes(String(method || '')),
  validate
});
