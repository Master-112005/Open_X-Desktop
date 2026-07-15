'use strict';

const { stableId } = require('../utils/gallery-utils');

class GalleryPlacesExperience {
  build(snapshot = {}) {
    const metadata = snapshot.metadata || {};
    const places = {};
    for (const photo of Object.values(snapshot.photos || {})) {
      const item = metadata[photo.id] || {};
      const label = item.city || item.place || item.location || item.country || this._fromPath(photo.filePath);
      const id = stableId('place', label || 'unknown');
      if (!places[id]) places[id] = { id, title: label || 'Unknown Places', photoIds: [], count: 0 };
      places[id].photoIds.push(photo.id);
      places[id].count += 1;
    }
    return { view: 'places', places: Object.values(places).sort((a, b) => b.count - a.count) };
  }

  _fromPath(filePath = '') {
    const match = String(filePath).match(/(goa|beach|college|office|school|home)/i);
    return match ? match[1] : '';
  }
}

module.exports = GalleryPlacesExperience;
