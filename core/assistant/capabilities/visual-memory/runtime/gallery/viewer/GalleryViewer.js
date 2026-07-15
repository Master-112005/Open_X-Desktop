'use strict';

class GalleryViewer {
  constructor({ recent, configuration, diagnostics } = {}) {
    this.recent = recent;
    this.configuration = configuration;
    this.diagnostics = diagnostics;
  }

  async open(photoId, snapshot = {}, options = {}) {
    const photo = snapshot.photos?.[photoId];
    if (!photo) throw new Error('Photo not found for Gallery viewer.');
    const allPhotos = Object.values(snapshot.photos || {}).sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
    const index = allPhotos.findIndex(item => item.id === photoId);
    const half = Math.floor(this.configuration.viewer.filmstripSize / 2);
    const filmstrip = allPhotos.slice(Math.max(0, index - half), index + half + 1);
    const metadata = snapshot.metadata?.[photoId] || null;
    const view = {
      view: 'viewer',
      photo: { ...photo, metadata },
      index,
      navigation: {
        previousPhotoId: allPhotos[index - 1]?.id || null,
        nextPhotoId: allPhotos[index + 1]?.id || null
      },
      filmstrip,
      zoom: options.zoom || this.configuration.viewer.defaultZoom,
      fullscreen: options.fullscreen === true,
      panels: ['metadata', 'timeline', 'related-memories', 'similar-photos', 'people', 'objects', 'ocr', 'location', 'event', 'collections'],
      quickActions: ['open', 'copy', 'favorite', 'archive', 'delete', 'open-with-assistant'],
      performsAnalysis: false
    };
    await this.recent.add('images', { id: photoId, photoId, fileName: photo.fileName });
    this.diagnostics?.record?.('viewer-opened', { photoId });
    return view;
  }
}

module.exports = GalleryViewer;
