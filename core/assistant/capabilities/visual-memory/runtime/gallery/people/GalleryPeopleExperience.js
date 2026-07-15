'use strict';

class GalleryPeopleExperience {
  build(faceMemory = {}) {
    const profiles = Object.values(faceMemory.profiles || {})
      .map(profile => ({
        ...profile,
        representativePhotoId: profile.representativePhotoId || null,
        representativeFaceBox: profile.representativeFaceBox || null
      }))
      .sort((left, right) => (right.photoCount || 0) - (left.photoCount || 0));
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
        label: 'Unnamed person',
        nameable: true,
        photoCount: cluster.photoIds?.length || 0,
        representativePhotoId: cluster.photoIds?.[0] || null,
        representativeFaceBox: cluster.representativeFaceBox || cluster.faceBoxes?.[0] || null,
        photoIds: Array.isArray(cluster.photoIds) ? cluster.photoIds.slice(0, 12) : [],
        firstSeenAt: cluster.firstSeenAt,
        latestSeenAt: cluster.latestSeenAt,
        confidence: cluster.confidence || 0
      })),
      relationshipGroups,
      performsRecognition: false
    };
  }
}

module.exports = GalleryPeopleExperience;
