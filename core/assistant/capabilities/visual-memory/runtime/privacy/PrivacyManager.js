'use strict';

class PrivacyManager {
  constructor({ database, settings, events, logger } = {}) {
    this.database = database;
    this.settings = settings;
    this.events = events;
    this.logger = logger || console;
  }

  async enable() {
    return this._setEnabled(true);
  }

  async disable() {
    return this._setEnabled(false);
  }

  async excludeFolder(folderPath) {
    const current = this.settings.getSettings();
    const excluded = new Set(current.privacy?.excludedFolders || []);
    excluded.add(String(folderPath || '').trim());
    const next = await this.settings.updateSettings({ privacy: { excludedFolders: Array.from(excluded) } });
    this._emit(next.privacy);
    return next.privacy;
  }

  async clearThumbnails() {
    await this.database.replaceTable('thumbnails', {});
    return { cleared: 'thumbnails' };
  }

  async deleteMetadata() {
    await this.database.replaceTable('metadata', {});
    return { cleared: 'metadata' };
  }

  async resetGallery() {
    await this.database.replaceTable('galleryState', { selectedPhotoIds: [], view: 'grid' });
    return this.database.getTable('galleryState');
  }

  async resetDatabase() {
    return this.database.reset();
  }

  getPrivacyState() {
    return this.settings.getSettings().privacy;
  }

  async _setEnabled(enabled) {
    const next = await this.settings.updateSettings({ enabled: Boolean(enabled) });
    this._emit({ enabled: next.enabled, ...next.privacy });
    return next;
  }

  _emit(payload) {
    this.events?.emit?.(this.events.VISUAL_MEMORY_EVENTS?.PRIVACY_UPDATED || 'visual-memory.privacy.updated', payload);
  }
}

module.exports = PrivacyManager;
