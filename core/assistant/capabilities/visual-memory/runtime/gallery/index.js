'use strict';

module.exports = {
  GalleryManager: require('./GalleryManager'),
  OpenXGalleryEngine: require('./engine/OpenXGalleryEngine'),
  GalleryExperienceConfiguration: require('./configuration/GalleryExperienceConfiguration'),
  GalleryExperienceDiagnostics: require('./diagnostics/GalleryExperienceDiagnostics'),
  GalleryExperienceLifecycle: require('./lifecycle/GalleryExperienceLifecycle'),
  GalleryExperienceValidator: require('./validation/GalleryExperienceValidator'),
  GalleryNavigationManager: require('./navigation/GalleryNavigationManager'),
  GalleryTimelineExperience: require('./timeline/GalleryTimelineExperience'),
  GalleryCollectionExperience: require('./collections/GalleryCollectionExperience'),
  GalleryPeopleExperience: require('./people/GalleryPeopleExperience'),
  GalleryPlacesExperience: require('./places/GalleryPlacesExperience'),
  GalleryObjectsExperience: require('./objects/GalleryObjectsExperience'),
  EventGalleryExperience: require('./events/EventGalleryExperience'),
  GalleryAlbumManager: require('./albums/GalleryAlbumManager'),
  FavoriteManager: require('./favorites/FavoriteManager'),
  RecentManager: require('./recent/RecentManager'),
  SelectionManager: require('./selection/SelectionManager'),
  GalleryFilterManager: require('./filters/GalleryFilterManager'),
  GallerySearchExperience: require('./search/GallerySearchExperience'),
  GalleryViewer: require('./viewer/GalleryViewer'),
  GallerySimilarityExperience: require('./similarity/GallerySimilarityExperience'),
  GalleryInteractionManager: require('./interactions/GalleryInteractionManager'),
  GalleryAccessibilityManager: require('./accessibility/GalleryAccessibilityManager'),
  ...require('./contracts/GalleryExperienceContracts'),
  ...require('./events/GalleryExperienceEvents')
};
