'use strict';

class GalleryManager {
  constructor({ database, validator, thumbnails, settings } = {}) {
    this.database = database;
    this.validator = validator;
    this.thumbnails = thumbnails;
    this.settings = settings;
    this.photoListCache = null;
  }

  getPhotos(query = {}) {
    const settings = this.settings.getSettings();
    const normalized = this.validator.validateGalleryQuery({ ...settings.gallery, ...query });
    const photos = this._getSortedPhotos(normalized);
    const start = (normalized.page - 1) * normalized.pageSize;
    const items = photos.slice(start, start + normalized.pageSize).map(photo => ({
      ...photo,
      thumbnail: this.thumbnails.getThumbnail(photo.id, query.thumbnailSize || 320)
    }));
    return {
      items,
      page: normalized.page,
      pageSize: normalized.pageSize,
      total: photos.length,
      hasMore: start + normalized.pageSize < photos.length
    };
  }

  _getSortedPhotos(normalized) {
    const table = this.database.getTable('photos');
    const cacheKey = [
      this.database.data?.updatedAt || '',
      Object.keys(table).length,
      normalized.folderId || '',
      normalized.fileType || '',
      normalized.sortBy || '',
      normalized.sortDirection || ''
    ].join('|');
    if (this.photoListCache?.key === cacheKey) return this.photoListCache.items;

    let photos = Object.values(table);
    if (normalized.folderId) photos = photos.filter(photo => photo.folderId === normalized.folderId);
    if (normalized.fileType) photos = photos.filter(photo => photo.fileType === normalized.fileType);
    photos.sort((left, right) => {
      const a = left[normalized.sortBy] || '';
      const b = right[normalized.sortBy] || '';
      return normalized.sortDirection === 'asc'
        ? String(a).localeCompare(String(b))
        : String(b).localeCompare(String(a));
    });
    this.photoListCache = { key: cacheKey, items: photos };
    return photos;
  }

  getPhoto(photoId) {
    const photo = this.database.getTable('photos')[photoId];
    return photo ? { ...photo, metadata: this.database.getTable('metadata')[photoId] || null } : null;
  }

  async updateGalleryState(patch = {}) {
    const current = this.database.getTable('galleryState');
    return this.database.replaceTable('galleryState', { ...current, ...patch, updatedAt: new Date().toISOString() });
  }

  getGalleryState() {
    return this.database.getTable('galleryState');
  }
}

module.exports = GalleryManager;
