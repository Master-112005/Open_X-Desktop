'use strict';

const CONTRACTS_VERSION = '1.1.0';

function validateContract(contract, value) {
  if (!contract || typeof contract.validate !== 'function') {
    return Object.freeze({ valid: false, errors: Object.freeze(['Contract does not provide validate().']) });
  }
  return contract.validate(value);
}

const ErrorContractFields = Object.freeze(['name', 'message', 'code', 'stageId', 'cause', 'stack']);
const ErrorContractRequired = Object.freeze(['name', 'message']);

const ErrorContract = Object.freeze({
  name: 'ErrorContract',
  version: '1.1.0',
  fields: ErrorContractFields,
  required: ErrorContractRequired,
  optional: Object.freeze(ErrorContractFields.filter(field => !ErrorContractRequired.includes(field))),
  hasField: field => ErrorContractFields.includes(String(field || '')),
  validate(value = {}) {
    const missing = ErrorContractRequired.filter(field => !value[field]);
    return Object.freeze({ valid: missing.length === 0, missing, fields: ErrorContractFields });
  }
});

const LoggerContractMethods = Object.freeze(['debug', 'info', 'warn', 'error']);

const LoggerContract = Object.freeze({
  name: 'LoggerContract',
  version: '1.1.0',
  methods: LoggerContractMethods,
  required: LoggerContractMethods,
  hasMethod: method => LoggerContractMethods.includes(String(method || '')),
  validate(logger = {}) {
    const missing = LoggerContractMethods.filter(method => typeof logger?.[method] !== 'function');
    return Object.freeze({ valid: missing.length === 0, missing, methods: LoggerContractMethods });
  }
});

const PipelineConfigurationFields = Object.freeze(['enabled', 'timeoutMs', 'continueOnStageFailure', 'collectDiagnostics', 'stages']);
const PipelineConfigurationDefaults = Object.freeze({
  enabled: true,
  timeoutMs: 30000,
  continueOnStageFailure: true,
  collectDiagnostics: true,
  stages: Object.freeze({})
});

const PipelineConfigurationContract = Object.freeze({
  name: 'PipelineConfigurationContract',
  version: '1.1.0',
  fields: PipelineConfigurationFields,
  defaults: PipelineConfigurationDefaults,
  hasField: field => PipelineConfigurationFields.includes(String(field || '')),
  validate(value = {}) {
    const errors = [];
    if (value.timeoutMs !== undefined && (!Number.isFinite(Number(value.timeoutMs)) || Number(value.timeoutMs) < 0)) {
      errors.push('timeoutMs must be a non-negative number.');
    }
    if (value.stages !== undefined && (!value.stages || typeof value.stages !== 'object' || Array.isArray(value.stages))) {
      errors.push('stages must be an object.');
    }
    return Object.freeze({ valid: errors.length === 0, errors, fields: PipelineConfigurationFields });
  }
});

const PipelineContextFields = Object.freeze([
  'requestId', 'conversationId', 'timestamp', 'source', 'rawInput',
  'normalizedInput', 'metadata', 'diagnostics', 'shared', 'stageOutputs', 'timing'
]);
const PipelineContextRequired = Object.freeze(['requestId', 'timestamp', 'source', 'rawInput']);

const PipelineContextContract = Object.freeze({
  name: 'PipelineContextContract',
  version: '1.1.0',
  fields: PipelineContextFields,
  required: PipelineContextRequired,
  optional: Object.freeze(PipelineContextFields.filter(field => !PipelineContextRequired.includes(field))),
  hasField: field => PipelineContextFields.includes(String(field || '')),
  validate(value = {}) {
    const missing = PipelineContextRequired.filter(field => value[field] === undefined || value[field] === null || value[field] === '');
    return Object.freeze({ valid: missing.length === 0, missing, fields: PipelineContextFields });
  }
});

const PipelineEventsList = Object.freeze([
  'PipelineStarted', 'PipelineFinished', 'StageStarted', 'StageCompleted',
  'StageFailed', 'PipelineCancelled', 'PipelineError'
]);

const PipelineEventsContract = Object.freeze({
  name: 'PipelineEventsContract',
  version: '1.1.0',
  events: PipelineEventsList,
  hasEvent: event => PipelineEventsList.includes(String(event || '')),
  validate(eventName) {
    const event = String(eventName || '');
    return Object.freeze({ valid: PipelineEventsList.includes(event), event, events: PipelineEventsList });
  }
});

const PipelineResultFields = Object.freeze(['success', 'cancelled', 'context', 'stageResults', 'output', 'diagnostics', 'timing', 'error']);
const PipelineResultRequired = Object.freeze(['success', 'cancelled', 'stageResults']);

const PipelineResultContract = Object.freeze({
  name: 'PipelineResultContract',
  version: '1.1.0',
  fields: PipelineResultFields,
  required: PipelineResultRequired,
  optional: Object.freeze(PipelineResultFields.filter(field => !PipelineResultRequired.includes(field))),
  hasField: field => PipelineResultFields.includes(String(field || '')),
  validate(value = {}) {
    const missing = PipelineResultRequired.filter(field => value[field] === undefined);
    const errors = [];
    if (value.stageResults !== undefined && !Array.isArray(value.stageResults)) {
      errors.push('stageResults must be an array.');
    }
    return Object.freeze({
      valid: missing.length === 0 && errors.length === 0,
      missing,
      errors,
      fields: PipelineResultFields
    });
  }
});

const PipelineStageMethods = Object.freeze(['initialize', 'validate', 'execute', 'cleanup', 'destroy']);
const PipelineStageRequired = Object.freeze(['execute']);

const PipelineStageContract = Object.freeze({
  name: 'PipelineStageContract',
  version: '1.1.0',
  methods: PipelineStageMethods,
  required: PipelineStageRequired,
  optional: Object.freeze(PipelineStageMethods.filter(method => !PipelineStageRequired.includes(method))),
  hasMethod: method => PipelineStageMethods.includes(String(method || '')),
  validate(stage = {}) {
    const missing = PipelineStageRequired.filter(method => typeof stage?.[method] !== 'function');
    const invalid = PipelineStageMethods
      .filter(method => stage?.[method] !== undefined && typeof stage[method] !== 'function');
    return Object.freeze({
      valid: missing.length === 0 && invalid.length === 0,
      missing,
      invalid,
      methods: PipelineStageMethods
    });
  }
});

const StageResultFields = Object.freeze(['stageId', 'success', 'skipped', 'cancelled', 'output', 'diagnostics', 'durationMs', 'error']);
const StageResultRequired = Object.freeze(['stageId', 'success', 'skipped', 'cancelled']);

const StageResultContract = Object.freeze({
  name: 'StageResultContract',
  version: '1.1.0',
  fields: StageResultFields,
  required: StageResultRequired,
  optional: Object.freeze(StageResultFields.filter(field => !StageResultRequired.includes(field))),
  hasField: field => StageResultFields.includes(String(field || '')),
  validate(value = {}) {
    const missing = StageResultRequired.filter(field => value[field] === undefined || value[field] === null || value[field] === '');
    const errors = [];
    if (value.durationMs !== undefined && (!Number.isFinite(Number(value.durationMs)) || Number(value.durationMs) < 0)) {
      errors.push('durationMs must be a non-negative number.');
    }
    return Object.freeze({
      valid: missing.length === 0 && errors.length === 0,
      missing,
      errors,
      fields: StageResultFields
    });
  }
});

module.exports = {
  CONTRACTS_VERSION,
  validateContract,
  ErrorContract,
  LoggerContract,
  PipelineConfigurationContract,
  PipelineContextContract,
  PipelineEventsContract,
  PipelineResultContract,
  PipelineStageContract,
  StageResultContract
};