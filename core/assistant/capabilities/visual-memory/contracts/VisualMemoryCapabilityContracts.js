'use strict';

const VISUAL_MEMORY_CAPABILITY_VERSION = '8.0.0';

const VISUAL_MEMORY_CAPABILITY_ACTIONS = Object.freeze([
  'search',
  'open',
  'close',
  'next',
  'previous',
  'zoom',
  'favorite',
  'move',
  'copy',
  'delete',
  'archive',
  'restore',
  'rename',
  'create-album',
  'create-collection',
  'merge',
  'compare',
  'send',
  'share',
  'duplicate-detection',
  'album-management',
  'collection-management'
]);

const VISUAL_MEMORY_HIGH_RISK_ACTIONS = Object.freeze([
  'delete',
  'delete-album',
  'delete-collection',
  'delete-identity',
  'move-bulk',
  'reset'
]);

const VISUAL_MEMORY_CAPABILITY_OUT_OF_SCOPE = Object.freeze([
  'new-nlp',
  'new-context-engine',
  'new-memory-engine',
  'new-planning-engine',
  'new-automation-engine',
  'new-ai-models',
  'gallery-ui',
  'face-detection',
  'ocr',
  'image-embeddings',
  'object-detection',
  'timeline-intelligence',
  'relationship-intelligence',
  'visual-memory-database'
]);

module.exports = Object.freeze({
  VISUAL_MEMORY_CAPABILITY_VERSION,
  VISUAL_MEMORY_CAPABILITY_ACTIONS,
  VISUAL_MEMORY_HIGH_RISK_ACTIONS,
  VISUAL_MEMORY_CAPABILITY_OUT_OF_SCOPE,
  VisualMemoryCapabilityContract: Object.freeze({
    id: 'assistant.capability.visualMemory',
    name: 'Visual Memory',
    firstClassCapability: true,
    owner: 'assistant',
    usesPublicApisOnly: true,
    supportedActions: VISUAL_MEMORY_CAPABILITY_ACTIONS,
    outOfScope: VISUAL_MEMORY_CAPABILITY_OUT_OF_SCOPE
  }),
  VisualMemoryActionContract: Object.freeze({
    input: Object.freeze(['action', 'target', 'entities', 'sessionId', 'pipelineContext']),
    output: Object.freeze(['type', 'action', 'success', 'data', 'requiresVerification', 'contextPatch'])
  }),
  VisualMemorySessionContract: Object.freeze({
    tracks: Object.freeze(['currentSearch', 'currentMemory', 'currentImage', 'currentViewer', 'currentSelection', 'currentFilters', 'undoHistory'])
  }),
  VisualMemoryContextContract: Object.freeze({
    contributes: Object.freeze(['currentMemory', 'currentImage', 'currentCollection', 'currentAlbum', 'currentTimeline', 'currentSearch', 'currentPeople', 'currentLocation', 'currentEvent', 'currentSelection'])
  }),
  VisualMemoryAutomationContract: Object.freeze({
    orchestratedByAssistant: true,
    visualMemoryExecutesAutomation: false
  }),
  VisualMemoryResponseContract: Object.freeze({
    structuredOnly: true,
    assistantGeneratesUserText: true
  }),
  VisualMemoryVerificationContract: Object.freeze({
    highRiskActions: VISUAL_MEMORY_HIGH_RISK_ACTIONS,
    asksBeforeExecution: true
  }),
  VisualMemorySearchContract: Object.freeze({
    consumes: Object.freeze(['visualQuery', 'visualMemorySearch', 'galleryApi'])
  }),
  VisualMemoryViewerContract: Object.freeze({
    controls: Object.freeze(['open', 'close', 'next', 'previous', 'zoom'])
  })
});
