'use strict';

module.exports = Object.freeze({
  lifecycle: Object.freeze(['initialize', 'start', 'pause', 'resume', 'stop', 'shutdown', 'getStatus', 'getHealth']),
  folders: Object.freeze(['listFolders', 'getFolder', 'addFolder', 'removeFolder', 'setFolderEnabled', 'getFolderStats']),
  gallery: Object.freeze(['refreshGallery', 'getPhotos', 'getPhoto', 'updateGalleryState', 'getGalleryState']),
  media: Object.freeze(['indexPhoto', 'getMetadata', 'generateThumbnail', 'getThumbnail']),
  privacy: Object.freeze(['enable', 'disable', 'excludeFolder', 'clearThumbnails', 'deleteMetadata', 'resetGallery', 'resetDatabase'])
});
