'use strict';

class GalleryInteractionManager {
  quickActions() {
    return [
      { id: 'open', title: 'Open', publicApiOnly: true },
      { id: 'copy', title: 'Copy', publicApiOnly: true },
      { id: 'favorite', title: 'Favorite', publicApiOnly: true },
      { id: 'archive', title: 'Archive', publicApiOnly: true },
      { id: 'delete', title: 'Delete', publicApiOnly: true },
      { id: 'open-with-assistant', title: 'Open with Assistant', publicApiOnly: true }
    ];
  }
}

module.exports = GalleryInteractionManager;
