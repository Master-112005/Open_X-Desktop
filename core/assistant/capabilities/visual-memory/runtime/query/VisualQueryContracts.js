'use strict';

const VISUAL_QUERY_VERSION = '2.0.0';

const VISUAL_QUERY_INTENTS = Object.freeze({
  SEARCH: 'photo.search',
  SHOW: 'photo.show',
  FIND: 'photo.find',
  UNKNOWN: 'photo.unknown'
});

const VISUAL_MEDIA_TYPES = Object.freeze([
  'photo',
  'picture',
  'image',
  'screenshot',
  'document',
  'album',
  'gallery',
  'wallpaper',
  'drawing',
  'future-media'
]);

const VISUAL_CONSTRAINT_TYPES = Object.freeze([
  'media',
  'owner',
  'person',
  'relationship',
  'time',
  'location',
  'scene',
  'event',
  'photoType',
  'personCount',
  'sourceApp',
  'documentType',
  'queryText'
]);

const OUT_OF_SCOPE = Object.freeze([
  'image-search',
  'image-recognition',
  'ocr',
  'face-recognition',
  'object-recognition',
  'embeddings',
  'vector-search',
  'filesystem-scan',
  'database-query'
]);

module.exports = Object.freeze({
  VISUAL_QUERY_VERSION,
  VISUAL_QUERY_INTENTS,
  VISUAL_MEDIA_TYPES,
  VISUAL_CONSTRAINT_TYPES,
  OUT_OF_SCOPE
});
