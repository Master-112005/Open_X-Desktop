'use strict';

const { constraintValues, includesAny } = require('../utils/intelligence-utils');

const COLLECTIONS = Object.freeze({
  trips: ['trip', 'vacation', 'travel', 'goa', 'beach', 'hotel', 'airport'],
  birthdays: ['birthday', 'cake', 'party'],
  family: ['family', 'mom', 'dad', 'brother', 'sister', 'parents'],
  friends: ['friend', 'friends', 'college'],
  documents: ['document', 'receipt', 'invoice', 'passport', 'license', 'bill'],
  screenshots: ['screenshot', 'whatsapp', 'instagram', 'desktop', 'terminal', 'ide', 'settings', 'payment'],
  office: ['office', 'meeting', 'work', 'colleague'],
  nature: ['beach', 'mountain', 'forest', 'garden', 'park', 'lake']
});

class SmartCollectionManager {
  inferCollections(context, candidates = []) {
    const queryValues = constraintValues(context.visualQuery, ['events', 'locations', 'scenes', 'photoTypes', 'sourceApps', 'relationships']);
    const collections = [];
    for (const [id, keywords] of Object.entries(COLLECTIONS)) {
      const matchedByQuery = queryValues.some(value => keywords.some(keyword => value.toLowerCase().includes(keyword)));
      const matchedCount = candidates.filter(candidate => includesAny([
        candidate.path,
        candidate.photo?.fileName,
        candidate.folder?.label,
        ...(candidate.albums || []).map(album => album.title || album.name)
      ].filter(Boolean).join(' '), keywords)).length;
      if (matchedByQuery || matchedCount > 0) {
        collections.push({ id, title: id.replace(/\b\w/g, char => char.toUpperCase()), confidence: matchedByQuery ? 0.82 : 0.55, matchedCount });
      }
    }
    return collections;
  }
}

module.exports = SmartCollectionManager;
