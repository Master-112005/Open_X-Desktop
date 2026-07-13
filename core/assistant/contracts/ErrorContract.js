'use strict';

const fields = Object.freeze(['name', 'message', 'code', 'stageId', 'cause', 'stack']);
const required = Object.freeze(['name', 'message']);

function validate(value = {}) {
  const missing = required.filter(field => !value[field]);
  return Object.freeze({
    valid: missing.length === 0,
    missing,
    fields
  });
}

module.exports = Object.freeze({
  name: 'ErrorContract',
  version: '1.1.0',
  fields,
  required,
  optional: Object.freeze(fields.filter(field => !required.includes(field))),
  hasField: field => fields.includes(String(field || '')),
  validate
});
