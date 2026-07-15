'use strict';

const MEMORY_INTELLIGENCE_VERSION = '5.0.0';

const MEMORY_RESULT_TYPES = Object.freeze({
  PHOTO: 'photo-memory',
  SCREENSHOT: 'screenshot-memory',
  DOCUMENT: 'document-memory',
  COLLECTION: 'collection-memory',
  EVENT: 'event-memory',
  UNKNOWN: 'unknown-memory'
});

const SEARCH_STRATEGIES = Object.freeze({
  OBJECT: 'object-search',
  SCENE: 'scene-search',
  DOCUMENT: 'document-search',
  RECEIPT: 'receipt-search',
  SCREENSHOT: 'screenshot-search',
  RELATIONSHIP: 'relationship-search',
  TIMELINE: 'timeline-search',
  MEMORY: 'memory-search',
  CONTEXT: 'context-search',
  SIMILARITY: 'similarity-search',
  COMBINED: 'combined-search'
});

const OUT_OF_SCOPE = Object.freeze([
  'new-nlp',
  'assistant-response-generation',
  'face-recognition-training',
  'person-naming',
  'model-loading',
  'ocr-models',
  'image-embedding-generation',
  'gallery-ui',
  'database-schema-migration',
  'thumbnail-generation',
  'ai-inference'
]);

const MemorySearchContract = Object.freeze({
  input: Object.freeze(['visualQuery', 'candidatePool', 'visionResults', 'assistantContext', 'previousSearch', 'options']),
  output: Object.freeze(['success', 'session', 'reasoning', 'validation', 'results', 'total', 'page', 'pageSize', 'hasMore', 'continuationToken'])
});

const MemoryRankingContract = Object.freeze({
  requiredSignals: Object.freeze(['context', 'relationships', 'timeline', 'vision', 'candidate', 'similarity']),
  output: Object.freeze(['score', 'confidence', 'evidence'])
});

const RelationshipContract = Object.freeze({
  consumes: Object.freeze(['assistant.people', 'assistant.relationships', 'visualQuery.relationships']),
  forbidden: Object.freeze(['face-naming', 'identity-decision'])
});

const TimelineContract = Object.freeze({
  consumes: Object.freeze(['visualQuery.time', 'candidate.metadata.createdAt', 'candidate.metadata.modifiedAt']),
  supports: Object.freeze(['first', 'latest', 'oldest', 'newest', 'before', 'after', 'between'])
});

const SimilarityContract = Object.freeze({
  consumes: Object.freeze(['visionResult.embeddings', 'referenceEmbedding']),
  forbidden: Object.freeze(['embedding-generation', 'embedding-storage'])
});

const CollectionContract = Object.freeze({
  output: Object.freeze(['id', 'title', 'confidence', 'matchedCount']),
  forbidden: Object.freeze(['folder-duplication'])
});

const ContextContract = Object.freeze({
  consumes: Object.freeze(['pipelineContext', 'assistantContext', 'previousSearch']),
  forbidden: Object.freeze(['new-context-engine'])
});

const ConfidenceContract = Object.freeze({
  range: Object.freeze([0, 1]),
  combines: Object.freeze(['vision', 'context', 'relationships', 'timeline', 'conversation', 'ranking'])
});

const SearchSessionContract = Object.freeze({
  lifecycle: Object.freeze(['start', 'complete', 'fail', 'cancel', 'paginate', 'continue']),
  supports: Object.freeze(['timeout', 'pagination', 'continuation', 'caching', 'statistics'])
});

const ConfigurationContract = Object.freeze({
  sections: Object.freeze(['ranking', 'search', 'collections', 'confidence'])
});

const DiagnosticsContract = Object.freeze({
  tracks: Object.freeze(['search-time', 'ranking', 'reasoning', 'collections', 'timeline', 'relationships', 'confidence', 'failures', 'performance', 'history'])
});

module.exports = Object.freeze({
  MEMORY_INTELLIGENCE_VERSION,
  MEMORY_RESULT_TYPES,
  SEARCH_STRATEGIES,
  OUT_OF_SCOPE,
  MemorySearchContract,
  MemoryRankingContract,
  RelationshipContract,
  TimelineContract,
  SimilarityContract,
  CollectionContract,
  ContextContract,
  ConfidenceContract,
  SearchSessionContract,
  ConfigurationContract,
  DiagnosticsContract
});
