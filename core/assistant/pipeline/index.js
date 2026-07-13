'use strict';

const PIPELINE_LAYER_VERSION = '1.1.0';

module.exports = {
  PIPELINE_LAYER_VERSION,
  PipelineBuilder: require('./PipelineBuilder'),
  PipelineConfiguration: require('./PipelineConfiguration'),
  PipelineContext: require('./PipelineContext'),
  PipelineDiagnostics: require('./PipelineDiagnostics'),
  PipelineEngine: require('./PipelineEngine'),
  PipelineEvents: require('./PipelineEvents'),
  PipelineLogger: require('./PipelineLogger'),
  PipelineManager: require('./PipelineManager'),
  PipelineRegistry: require('./PipelineRegistry'),
  PipelineResult: require('./PipelineResult'),
  PipelineStage: require('./PipelineStage'),
  StageResult: require('./StageResult'),
  ...require('./PipelineError')
};
