'use strict';

const VisualMemoryAPI = require('./api/VisualMemoryAPI');
const VisualMemoryEngine = require('./engine/VisualMemoryEngine');
const VisualMemoryDatabase = require('./database/VisualMemoryDatabase');
const DiagnosticsManager = require('./diagnostics/DiagnosticsManager');
const { VisualMemoryEventBus, VISUAL_MEMORY_EVENTS } = require('./events/VisualMemoryEvents');
const FolderManager = require('./folders/FolderManager');
const GalleryManager = require('./gallery/GalleryManager');
const LifecycleManager = require('./lifecycle/LifecycleManager');
const MetadataManager = require('./metadata/MetadataManager');
const PrivacyManager = require('./privacy/PrivacyManager');
const SettingsManager = require('./settings/SettingsManager');
const ThumbnailManager = require('./thumbnails/ThumbnailManager');
const VisualMemoryValidator = require('./validation/VisualMemoryValidator');
const contracts = require('./contracts');
const constants = require('./utils/constants');
const query = require('./query');
const filtering = require('./filtering');
const faces = require('./faces');
const galleryExperience = require('./gallery');
const intelligence = require('./intelligence');
const learning = require('./learning');

module.exports = {
  VisualMemoryAPI,
  VisualMemoryEngine,
  VisualMemoryDatabase,
  DiagnosticsManager,
  VISUAL_MEMORY_EVENTS,
  VisualMemoryEventBus,
  FolderManager,
  GalleryManager,
  LifecycleManager,
  MetadataManager,
  PrivacyManager,
  SettingsManager,
  ThumbnailManager,
  VisualMemoryValidator,
  query,
  ...query,
  filtering,
  ...filtering,
  faces,
  ...faces,
  galleryExperience,
  ...galleryExperience,
  intelligence,
  ...intelligence,
  learning,
  ...learning,
  contracts,
  constants
};
