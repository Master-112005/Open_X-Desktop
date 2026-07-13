'use strict';

const methods = Object.freeze(['initialize', 'validate', 'execute', 'cleanup', 'destroy']);
const required = Object.freeze(['execute']);

function validate(stage = {}) {
  const missing = required.filter(method => typeof stage?.[method] !== 'function');
  const invalid = methods
    .filter(method => stage?.[method] !== undefined && typeof stage[method] !== 'function');
  return Object.freeze({
    valid: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    methods
  });
}

module.exports = Object.freeze({
  name: 'PipelineStageContract',
  version: '1.1.0',
  methods,
  required,
  optional: Object.freeze(methods.filter(method => !required.includes(method))),
  hasMethod: method => methods.includes(String(method || '')),
  validate
});
