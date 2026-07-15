'use strict';

const { stableId } = require('../utils/gallery-utils');

class GalleryAlbumManager {
  build(snapshot = {}) {
    return {
      view: 'albums',
      albums: Object.values(snapshot.albums || {}).map(album => ({
        ...album,
        id: album.id || stableId('album', album.title || album.name),
        userManaged: true
      }))
    };
  }
}

module.exports = GalleryAlbumManager;
