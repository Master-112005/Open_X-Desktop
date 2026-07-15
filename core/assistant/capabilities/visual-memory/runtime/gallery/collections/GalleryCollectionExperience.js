'use strict';

class GalleryCollectionExperience {
  build(snapshot = {}, intelligenceHealth = null) {
    const metadata = snapshot.metadata || {};
    const photos = Object.values(snapshot.photos || {});
    const collections = [
      this._collection('recently-added', 'Recently Added', photos.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 50)),
      this._collection('screenshots', 'Screenshots', photos.filter(photo => metadata[photo.id]?.photoType === 'screenshot' || /screenshot/i.test(photo.fileName || photo.filePath || ''))),
      this._collection('receipts', 'Receipts', photos.filter(photo => metadata[photo.id]?.photoType === 'receipt' || /receipt|invoice/i.test(photo.fileName || photo.filePath || ''))),
      this._collection('documents', 'Documents', photos.filter(photo => ['document', 'pdf-preview'].includes(metadata[photo.id]?.photoType))),
      ...Object.values(snapshot.faceMemory?.relationships || {}).map(relationship => this._collection(`people:${relationship.relationship}`, relationship.relationship, []))
    ].filter(collection => collection.count > 0 || collection.id.startsWith('people:'));
    return {
      view: 'collections',
      intelligenceReady: Boolean(intelligenceHealth?.initialized),
      collections
    };
  }

  _collection(id, title, photos) {
    return {
      id,
      title,
      count: photos.length,
      photoIds: photos.map(photo => photo.id),
      dynamic: true,
      duplicatesStorage: false
    };
  }
}

module.exports = GalleryCollectionExperience;
