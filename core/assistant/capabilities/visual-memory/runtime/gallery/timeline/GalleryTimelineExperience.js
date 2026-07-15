'use strict';

const { groupBy, pageItems, photoTimestamp } = require('../utils/gallery-utils');

class GalleryTimelineExperience {
  constructor({ configuration } = {}) {
    this.configuration = configuration;
  }

  build(snapshot = {}, options = {}) {
    const metadata = snapshot.metadata || {};
    const photos = Object.values(snapshot.photos || {})
      .map(photo => ({ ...photo, metadata: metadata[photo.id] || null, timestamp: photoTimestamp(photo, metadata[photo.id] || {}) }))
      .sort((left, right) => right.timestamp - left.timestamp);
    const group = options.group || this.configuration.timeline.defaultGroup;
    const grouped = groupBy(photos, photo => this._bucket(photo.timestamp, group));
    const sections = Object.entries(grouped).map(([id, items]) => ({
      id,
      title: id,
      count: items.length,
      highlights: items.slice(0, this.configuration.timeline.highlightLimit),
      virtual: true
    }));
    return {
      view: 'timeline',
      group,
      sections,
      page: pageItems(photos, { page: options.page, pageSize: options.pageSize || this.configuration.performance.virtualPageSize }),
      statistics: { totalPhotos: photos.length, sectionCount: sections.length }
    };
  }

  _bucket(timestamp, group) {
    if (!timestamp) return 'Unknown Date';
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    if (group === 'year') return String(year);
    if (group === 'day') return `${year}-${month}-${day}`;
    if (group === 'week') {
      const first = new Date(year, 0, 1);
      const week = Math.ceil((((date - first) / 86400000) + first.getDay() + 1) / 7);
      return `${year}-W${String(week).padStart(2, '0')}`;
    }
    return `${year}-${month}`;
  }
}

module.exports = GalleryTimelineExperience;
