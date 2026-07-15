'use strict';

const { stableId } = require('../utils/gallery-utils');

class GalleryObjectsExperience {
  build(visionResults = {}) {
    const objects = {};
    for (const [photoId, result] of Object.entries(visionResults || {})) {
      for (const object of result.objects || []) {
        const title = object.label || object.name;
        const id = stableId('object', title);
        if (!objects[id]) objects[id] = { id, title, photoIds: [], count: 0, confidence: 0 };
        objects[id].photoIds.push(photoId);
        objects[id].count += 1;
        objects[id].confidence = Math.max(objects[id].confidence, object.confidence || 0);
      }
    }
    return { view: 'objects', objects: Object.values(objects).sort((a, b) => b.count - a.count), consumesVisionOutputOnly: true };
  }
}

module.exports = GalleryObjectsExperience;
