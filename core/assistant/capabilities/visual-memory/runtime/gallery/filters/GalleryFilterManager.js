'use strict';

class GalleryFilterManager {
  constructor({ validator } = {}) {
    this.validator = validator;
  }

  apply(items = [], filter = {}) {
    const validation = this.validator.validateFilter(filter);
    if (!validation.valid) throw new Error(validation.reason);
    return items.filter(item => {
      if (filter.mediaType && item.fileType !== filter.mediaType) return false;
      if (filter.collection && !(item.collectionIds || []).includes(filter.collection)) return false;
      if (filter.favorite === true && !item.favorite) return false;
      if (filter.orientation && item.metadata?.orientation !== filter.orientation) return false;
      if (filter.sourceApp && item.metadata?.sourceApp !== filter.sourceApp) return false;
      if (filter.photoType && item.metadata?.photoType !== filter.photoType) return false;
      return true;
    });
  }
}

module.exports = GalleryFilterManager;
