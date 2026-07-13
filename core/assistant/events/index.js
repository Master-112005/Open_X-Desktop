'use strict';

const PipelineEventDispatcher = require('./PipelineEventDispatcher');
const PipelineEvents = require('./PipelineEvents');

function createPipelineEventDispatcher(options = {}) {
  return new PipelineEventDispatcher(options);
}

module.exports = {
  PipelineEventDispatcher,
  PipelineEvents,
  createPipelineEventDispatcher,
  isPipelineEvent: PipelineEvents.isPipelineEvent,
  pipelineEventValues: PipelineEvents.values
};
