'use strict';

const fields = Object.freeze(['success', 'cancelled', 'context', 'stageResults', 'output', 'diagnostics', 'timing', 'error']);
const required = Object.freeze(['success', 'cancelled', 'stageResults']);

function validate(value = {}) {
  const missing = required.filter(field => value[field] === undefined);
  const errors = [];
  if (value.stageResults !== undefined && !Array.isArray(value.stageResults)) {
    errors.push('stageResults must be an array.');
  }
  return Object.freeze({
    valid: missing.length === 0 && errors.length === 0,
    missing,
    errors,
    fields
  });
}

module.exports = Object.freeze({
  name: 'PipelineResultContract',
  version: '1.1.0',
  fields,
  required,
  optional: Object.freeze(fields.filter(field => !required.includes(field))),
  hasField: field => fields.includes(String(field || '')),
  validate
});
