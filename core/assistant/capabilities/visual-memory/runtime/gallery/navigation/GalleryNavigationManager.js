'use strict';

const { NavigationContract } = require('../contracts/GalleryExperienceContracts');

class GalleryNavigationManager {
  constructor({ configuration, diagnostics } = {}) {
    this.configuration = configuration;
    this.diagnostics = diagnostics;
  }

  getNavigation(snapshot = {}) {
    const enabled = this.configuration.navigation.enabledViews || NavigationContract.views;
    const counts = this._counts(snapshot);
    return enabled.map(view => ({
      id: view,
      title: this._title(view),
      count: counts[view] || 0,
      virtualized: ['timeline', 'search-results', 'recent', 'favorites'].includes(view),
      keyboard: true,
      touch: true
    }));
  }

  open(view, details = {}) {
    this.diagnostics?.record?.('navigation-open', { view, ...details });
    return { view, openedAt: new Date().toISOString(), details };
  }

  _title(view) {
    return String(view).split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }

  _counts(snapshot) {
    const photos = Object.values(snapshot.photos || {});
    const metadata = snapshot.metadata || {};
    return {
      timeline: photos.length,
      screenshots: photos.filter(photo => metadata[photo.id]?.photoType === 'screenshot' || /screenshot/i.test(photo.fileName || photo.filePath || '')).length,
      documents: photos.filter(photo => ['document', 'pdf-preview'].includes(metadata[photo.id]?.photoType)).length,
      receipts: photos.filter(photo => metadata[photo.id]?.photoType === 'receipt' || /receipt|invoice/i.test(photo.fileName || photo.filePath || '')).length,
      albums: Object.keys(snapshot.albums || {}).length,
      favorites: Object.keys(snapshot.galleryState?.experience?.favorites?.images || {}).length,
      recent: (snapshot.galleryState?.experience?.recent?.images || []).length,
      collections: Object.keys(snapshot.galleryState?.experience?.collections || {}).length,
      people: Object.keys(snapshot.faceMemory?.profiles || {}).length
    };
  }
}

module.exports = GalleryNavigationManager;
