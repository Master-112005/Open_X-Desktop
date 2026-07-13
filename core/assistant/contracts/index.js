'use strict';

const CONTRACTS_VERSION = '1.1.0';

function validateContract(contract, value) {
  if (!contract || typeof contract.validate !== 'function') {
    return Object.freeze({ valid: false, errors: Object.freeze(['Contract does not provide validate().']) });
  }
  return contract.validate(value);
}

module.exports = {
  CONTRACTS_VERSION,
  validateContract,
  ErrorContract: require('./ErrorContract'),
  LoggerContract: require('./LoggerContract'),
  PipelineConfigurationContract: require('./PipelineConfigurationContract'),
  PipelineContextContract: require('./PipelineContextContract'),
  PipelineEventsContract: require('./PipelineEventsContract'),
  PipelineResultContract: require('./PipelineResultContract'),
  PipelineStageContract: require('./PipelineStageContract'),
  StageResultContract: require('./StageResultContract')
};
