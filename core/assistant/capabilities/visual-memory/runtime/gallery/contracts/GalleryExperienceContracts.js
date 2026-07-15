'use strict';

const GALLERY_EXPERIENCE_VERSION = '7.0.0';

const GALLERY_OUT_OF_SCOPE = Object.freeze([
  'nlp',
  'ai-inference',
  'ocr',
  'face-detection',
  'face-embeddings',
  'object-detection',
  'image-indexing',
  'candidate-filtering',
  'memory-ranking',
  'relationship-reasoning',
  'timeline-reasoning',
  'visual-query-parsing',
  'database-schema'
]);

const GalleryContract = Object.freeze({
  version: GALLERY_EXPERIENCE_VERSION,
  role: 'presentation-layer',
  consumes: Object.freeze(['visualMemoryApi', 'visualMemoryDatabase', 'visualMemoryIntelligence', 'faceMemory']),
  forbidden: GALLERY_OUT_OF_SCOPE,
  localFirst: true
});

module.exports = Object.freeze({
  GALLERY_EXPERIENCE_VERSION,
  GALLERY_OUT_OF_SCOPE,
  GalleryContract,
  ViewerContract: Object.freeze({ supports: Object.freeze(['zoom', 'pan', 'fullscreen', 'filmstrip', 'metadata', 'related', 'quick-actions']) }),
  NavigationContract: Object.freeze({ views: Object.freeze(['timeline', 'people', 'places', 'events', 'objects', 'collections', 'albums', 'favorites', 'recent', 'screenshots', 'documents', 'receipts', 'search-results']) }),
  TimelineContract: Object.freeze({ groups: Object.freeze(['year', 'month', 'week', 'day', 'event']) }),
  CollectionContract: Object.freeze({ dynamic: true, duplicatesStorage: false }),
  AlbumContract: Object.freeze({ managedByUser: true, replacesCollections: false }),
  SearchViewContract: Object.freeze({ consumesSearchResults: true, performsNlp: false }),
  FilterContract: Object.freeze({ independentFromSearch: true }),
  SelectionContract: Object.freeze({ modes: Object.freeze(['single', 'multiple', 'range', 'query']) }),
  RecentContract: Object.freeze({ tracks: Object.freeze(['images', 'memories', 'searches', 'people', 'collections', 'locations']) }),
  FavoriteContract: Object.freeze({ targets: Object.freeze(['images', 'memories', 'people', 'collections', 'albums', 'locations']) }),
  ConfigurationContract: Object.freeze({ sections: Object.freeze(['layout', 'thumbnails', 'timeline', 'performance', 'viewer', 'accessibility', 'navigation', 'sorting', 'theme']) }),
  DiagnosticsContract: Object.freeze({ tracks: Object.freeze(['navigation', 'view-change', 'loading', 'performance', 'errors', 'warnings', 'search', 'selection', 'viewer']) })
});
