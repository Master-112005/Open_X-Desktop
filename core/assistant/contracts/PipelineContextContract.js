'use strict';

const fields = Object.freeze([
    'requestId',
    'conversationId',
    'timestamp',
    'source',
    'rawInput',
    'normalizedInput',
    'metadata',
    'diagnostics',
    'shared',
    'stageOutputs',
    'timing'
  ]);
const required = Object.freeze(['requestId', 'timestamp', 'source', 'rawInput']);

function validate(value = {}) {
  const missing = required.filter(field => value[field] === undefined || value[field] === null || value[field] === '');
  return Object.freeze({
    valid: missing.length === 0,
    missing,
    fields
  });
}

module.exports = Object.freeze({
  name: 'PipelineContextContract',
  version: '1.1.0',
  fields,
  required,
  optional: Object.freeze(fields.filter(field => !required.includes(field))),
  hasField: field => fields.includes(String(field || '')),
  validate
});
