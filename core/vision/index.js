'use strict';

module.exports = {
  VisionEngine: require('./engine/VisionEngine'),
  VisionConfiguration: require('./configuration/VisionConfiguration'),
  VisionDiagnostics: require('./diagnostics/VisionDiagnostics'),
  VisionLifecycle: require('./lifecycle/VisionLifecycle'),
  ModelRegistry: require('./registry/ModelRegistry'),
  RuntimeManager: require('./runtime/RuntimeManager'),
  ModelManager: require('./models/ModelManager'),
  ResourceManager: require('./managers/ResourceManager'),
  VisionValidator: require('./validation/VisionValidator'),
  ImagePreprocessingPipeline: require('./preprocessing/ImagePreprocessingPipeline'),
  VisionPostprocessor: require('./postprocessing/VisionPostprocessor'),
  ConfidenceEngine: require('./confidence/ConfidenceEngine'),
  EmbeddingManager: require('./embeddings/EmbeddingManager'),
  InferenceCoordinator: require('./inference/InferenceCoordinator'),
  VisionResult: require('./inference/VisionResult'),
  ...require('./contracts/VisionContracts'),
  ...require('./events/VisionEvents')
};
