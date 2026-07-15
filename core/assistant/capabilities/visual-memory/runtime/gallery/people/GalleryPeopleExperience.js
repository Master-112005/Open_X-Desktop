'use strict';

class GalleryPeopleExperience {
  build(faceMemory = {}) {
    const profiles = Object.values(faceMemory.profiles || {}).sort((left, right) => (right.photoCount || 0) - (left.photoCount || 0));
    const unknown = Object.values(faceMemory.unknownClusters || {}).filter(cluster => cluster.status === 'unknown' && !cluster.neverAskAgain);
    const relationshipGroups = {};
    for (const profile of profiles) {
      const key = profile.relationship || 'people';
      if (!relationshipGroups[key]) relationshipGroups[key] = [];
      relationshipGroups[key].push(profile.id);
    }
    return {
      view: 'people',
      known: profiles,
      unknown: unknown.map(cluster => ({
        clusterId: cluster.id,
        photoCount: cluster.photoIds?.length || 0,
        firstSeenAt: cluster.firstSeenAt,
        latestSeenAt: cluster.latestSeenAt
      })),
      relationshipGroups,
      performsRecognition: false
    };
  }
}

module.exports = GalleryPeopleExperience;
