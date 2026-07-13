'use strict';

const PipelineEvents = require('../events/PipelineEvents');

module.exports = Object.freeze({
  ...PipelineEvents,
  PIPELINE_EVENTS_BRIDGE_VERSION: '1.1.0'
});
