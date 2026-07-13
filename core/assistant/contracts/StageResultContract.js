'use strict';

const fields = Object.freeze(['stageId', 'success', 'skipped', 'cancelled', 'output', 'diagnostics', 'durationMs', 'error']);
const required = Object.freeze(['stageId', 'success', 'skipped', 'cancelled']);

function validate(value = {}) {
  const missing = required.filter(field => value[field] === undefined || value[field] === null || value[field] === '');
  const errors = [];
  if (value.durationMs !== undefined && (!Number.isFinite(Number(value.durationMs)) || Number(value.durationMs) < 0)) {
    errors.push('durationMs must be a non-negative number.');
  }
  return Object.freeze({
    valid: missing.length === 0 && errors.length === 0,
    missing,
    errors,
    fields
  });
}

module.exports = Object.freeze({
  name: 'StageResultContract',
  version: '1.1.0',
  fields,
  required,
  optional: Object.freeze(fields.filter(field => !required.includes(field))),
  hasField: field => fields.includes(String(field || '')),
  validate
});
