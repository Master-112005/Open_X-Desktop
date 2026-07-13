'use strict';

const assert = require('assert');

const {
  CONTRACTS_VERSION,
  ErrorContract,
  LoggerContract,
  PipelineConfigurationContract,
  PipelineContextContract,
  PipelineEventsContract,
  PipelineResultContract,
  PipelineStageContract,
  StageResultContract,
  validateContract
} = require('../../core/assistant/contracts');

describe('Assistant Contracts', function() {
  it('exports a versioned contract surface', function() {
    assert.match(CONTRACTS_VERSION, /^\d+\.\d+\.\d+$/);
  });

  it('validates logger and stage method contracts', function() {
    assert.equal(LoggerContract.validate(console).valid, true);
    assert.deepEqual(LoggerContract.validate({ info() {} }).missing, ['debug', 'warn', 'error']);
    assert.equal(PipelineStageContract.validate({ execute() {} }).valid, true);
    assert.equal(PipelineStageContract.validate({ execute: true }).valid, false);
  });

  it('validates pipeline context, stage result, and pipeline result fields', function() {
    assert.equal(PipelineContextContract.validate({
      requestId: 'r1',
      timestamp: Date.now(),
      source: 'chat',
      rawInput: 'open chrome'
    }).valid, true);
    assert.equal(StageResultContract.validate({
      stageId: 'stage',
      success: true,
      skipped: false,
      cancelled: false,
      durationMs: 1
    }).valid, true);
    assert.equal(PipelineResultContract.validate({
      success: true,
      cancelled: false,
      stageResults: []
    }).valid, true);
  });

  it('validates configuration, errors, and events', function() {
    assert.equal(PipelineConfigurationContract.validate({ timeoutMs: -1 }).valid, false);
    assert.equal(ErrorContract.validate({ name: 'Error', message: 'failed' }).valid, true);
    assert.equal(PipelineEventsContract.hasEvent('StageCompleted'), true);
    assert.equal(PipelineEventsContract.validate('Unknown').valid, false);
  });

  it('provides generic contract validation helper', function() {
    assert.equal(validateContract(LoggerContract, console).valid, true);
    assert.equal(validateContract({}, {}).valid, false);
  });
});
