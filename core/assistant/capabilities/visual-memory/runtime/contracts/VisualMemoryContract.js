'use strict';

module.exports = Object.freeze({
  name: 'VisualMemoryEngine',
  version: 1,
  capabilities: Object.freeze([
    'local-gallery-state',
    'folder-management',
    'metadata-indexing',
    'thumbnail-cache',
    'privacy-controls',
    'diagnostics',
    'lifecycle'
  ]),
  forbiddenCapabilities: Object.freeze([
    'cloud-upload',
    'semantic-search',
    'face-recognition',
    'ocr',
    'ai-captioning'
  ])
});
