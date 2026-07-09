'use strict';

module.exports = Object.freeze({
  events: Object.freeze([
    'PipelineStarted',
    'PipelineFinished',
    'StageStarted',
    'StageCompleted',
    'StageFailed',
    'PipelineCancelled',
    'PipelineError'
  ])
});
