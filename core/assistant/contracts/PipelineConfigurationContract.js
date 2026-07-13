'use strict';

const fields = Object.freeze(['enabled', 'timeoutMs', 'continueOnStageFailure', 'collectDiagnostics', 'stages']);
const defaults = Object.freeze({
  enabled: true,
  timeoutMs: 30000,
  continueOnStageFailure: true,
  collectDiagnostics: true,
  stages: Object.freeze({})
});

function validate(value = {}) {
  const errors = [];
  if (value.timeoutMs !== undefined && (!Number.isFinite(Number(value.timeoutMs)) || Number(value.timeoutMs) < 0)) {
    errors.push('timeoutMs must be a non-negative number.');
  }
  if (value.stages !== undefined && (!value.stages || typeof value.stages !== 'object' || Array.isArray(value.stages))) {
    errors.push('stages must be an object.');
  }
  return Object.freeze({ valid: errors.length === 0, errors, fields });
}

module.exports = Object.freeze({
  name: 'PipelineConfigurationContract',
  version: '1.1.0',
  fields,
  defaults,
  hasField: field => fields.includes(String(field || '')),
  validate
});
