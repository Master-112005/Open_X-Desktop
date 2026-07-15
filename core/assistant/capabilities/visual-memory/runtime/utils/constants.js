'use strict';

const path = require('path');

const VISUAL_MEMORY_SCHEMA_VERSION = 1;
const VISUAL_MEMORY_STATE_VERSION = '1.0.0';
const IMAGE_EXTENSIONS = Object.freeze(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif']);
const DEFAULT_THUMBNAIL_SIZES = Object.freeze([160, 320, 640]);

const DEFAULT_VISUAL_MEMORY_SETTINGS = Object.freeze({
  version: VISUAL_MEMORY_STATE_VERSION,
  enabled: true,
  gallery: {
    pageSize: 60,
    sortBy: 'createdAt',
    sortDirection: 'desc',
    filter: 'all'
  },
  thumbnails: {
    enabled: true,
    sizes: DEFAULT_THUMBNAIL_SIZES,
    cacheLimitMb: 512
  },
  performance: {
    maxConcurrentJobs: 2,
    maxIndexDepth: 8,
    maxIndexFiles: 50000,
    lazyLoad: true,
    idleIndexing: true
  },
  privacy: {
    localOnly: true,
    excludedFolders: [],
    allowFutureAi: false,
    allowFutureOcr: false,
    allowFutureFaceRecognition: false
  },
  diagnostics: {
    enabled: true,
    maxEvents: 500
  },
  storage: {
    dataFile: 'visual-memory-db.json',
    thumbnailDir: 'thumbnails'
  }
});

function defaultVisualMemoryDataDir(rootDir = process.cwd()) {
  return path.join(rootDir, 'data', 'visual-memory');
}

module.exports = {
  DEFAULT_THUMBNAIL_SIZES,
  DEFAULT_VISUAL_MEMORY_SETTINGS,
  IMAGE_EXTENSIONS,
  VISUAL_MEMORY_SCHEMA_VERSION,
  VISUAL_MEMORY_STATE_VERSION,
  defaultVisualMemoryDataDir
};
