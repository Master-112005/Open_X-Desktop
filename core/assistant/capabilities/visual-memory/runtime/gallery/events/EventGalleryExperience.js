'use strict';

const { stableId } = require('../utils/gallery-utils');

class EventGalleryExperience {
  build(memorySearchResult = {}, snapshot = {}) {
    const events = {};
    for (const collection of memorySearchResult.reasoning?.collections || []) {
      const id = stableId('event', collection.id || collection.title);
      events[id] = {
        id,
        title: collection.title || collection.id,
        count: collection.matchedCount || 0,
        confidence: collection.confidence || 0,
        source: 'visual-memory-intelligence'
      };
    }
    for (const folder of Object.values(snapshot.folders || {})) {
      if (!/(trip|birthday|wedding|college|office|festival|meeting|vacation)/i.test(`${folder.label || ''} ${folder.path || ''}`)) continue;
      const id = stableId('event', folder.label || folder.path);
      events[id] = events[id] || { id, title: folder.label || folder.path, count: 0, confidence: 0.4, source: 'visual-memory-database' };
    }
    return { view: 'events', events: Object.values(events) };
  }
}

module.exports = EventGalleryExperience;
