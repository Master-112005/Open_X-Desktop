'use strict';

const CANDIDATE_FILTER_VERSION = '3.0.0';

const FILTER_IDS = Object.freeze({
  METADATA: 'metadata',
  DATE: 'date',
  FOLDER: 'folder',
  GPS: 'gps',
  CAMERA: 'camera',
  ALBUM: 'album',
  SCREENSHOT: 'screenshot',
  PERSON_COUNT: 'person-count',
  DUPLICATE: 'duplicate',
  RANKING: 'ranking'
});

const DEFAULT_FILTER_ORDER = Object.freeze([
  FILTER_IDS.METADATA,
  FILTER_IDS.DATE,
  FILTER_IDS.FOLDER,
  FILTER_IDS.GPS,
  FILTER_IDS.CAMERA,
  FILTER_IDS.ALBUM,
  FILTER_IDS.SCREENSHOT,
  FILTER_IDS.PERSON_COUNT,
  FILTER_IDS.DUPLICATE,
  FILTER_IDS.RANKING
]);

const OUT_OF_SCOPE = Object.freeze([
  'ai-inference',
  'ocr',
  'face-recognition',
  'object-detection',
  'image-decoding',
  'pixel-analysis',
  'embeddings',
  'semantic-similarity',
  'internet-location-lookup'
]);

module.exports = Object.freeze({
  CANDIDATE_FILTER_VERSION,
  DEFAULT_FILTER_ORDER,
  FILTER_IDS,
  OUT_OF_SCOPE
});
