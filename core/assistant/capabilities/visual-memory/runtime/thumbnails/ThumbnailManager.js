'use strict';

const path = require('path');
const { ensureDir, hashPath } = require('../utils/FileSystemUtils');
const { writeSecureJsonAtomic } = require('../../../../Data');

class ThumbnailManager {
  constructor({ database, settings, events, thumbnailDir, adapter, logger } = {}) {
    this.database = database;
    this.settings = settings;
    this.events = events;
    this.thumbnailDir = thumbnailDir;
    this.adapter = adapter || null;
    this.logger = logger || console;
  }

  async generateThumbnail(photoId, size = 320) {
    const photo = this.database.getTable('photos')[photoId];
    if (!photo) throw new Error('Photo is not indexed');
    const settings = this.settings.getSettings();
    if (settings.thumbnails?.enabled === false) throw new Error('Thumbnail generation is disabled');
    const safeSize = this._safeSize(size, settings.thumbnails?.sizes);
    await ensureDir(this.thumbnailDir);
    const id = `${photoId}:${safeSize}`;
    const cachePath = path.join(this.thumbnailDir, `${hashPath(id)}.json`);

    let adapterResult = null;
    if (this.adapter && typeof this.adapter.generate === 'function') {
      adapterResult = await this.adapter.generate({ sourcePath: photo.filePath, size: safeSize, outputDir: this.thumbnailDir, photo });
    }

    const record = {
      id,
      photoId,
      size: safeSize,
      sourcePath: photo.filePath,
      thumbnailPath: adapterResult?.thumbnailPath || cachePath,
      generatedAt: new Date().toISOString(),
      generator: adapterResult?.generator || 'metadata-placeholder'
    };
    if (!adapterResult?.thumbnailPath) {
      writeSecureJsonAtomic(cachePath, { type: 'visual-memory-thumbnail-placeholder', photoId, sourcePath: photo.filePath, size: safeSize });
    }
    await this.database.upsert('thumbnails', id, record);
    this.events?.emit?.(this.events.VISUAL_MEMORY_EVENTS?.THUMBNAIL_GENERATED || 'visual-memory.thumbnail.generated', record);
    return record;
  }

  getThumbnail(photoId, size = 320) {
    return this.database.getTable('thumbnails')[`${photoId}:${size}`] || null;
  }

  async deleteInvalidThumbnails() {
    const thumbnails = this.database.getTable('thumbnails');
    const photos = this.database.getTable('photos');
    const kept = {};
    let removed = 0;
    for (const [id, thumbnail] of Object.entries(thumbnails)) {
      if (photos[thumbnail.photoId]) kept[id] = thumbnail;
      else removed += 1;
    }
    await this.database.replaceTable('thumbnails', kept);
    return { removed };
  }

  _safeSize(size, allowedSizes = []) {
    const value = Number(size || 320);
    const allowed = (allowedSizes || []).map(Number).filter(Number.isFinite);
    return allowed.includes(value) ? value : (allowed[0] || 320);
  }
}

module.exports = ThumbnailManager;
