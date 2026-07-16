'use strict';

class GalleryPeopleExperience {
  build(faceMemory = {}) {
    const profiles = Object.values(faceMemory.profiles || {})
      .map(profile => this._profileWithRepresentative(profile, faceMemory))
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

  _profileWithRepresentative(profile = {}, faceMemory = {}) {
    const fallback = this._findProfileRepresentative(profile, faceMemory);
    return {
      ...profile,
      representativePhotoId: profile.representativePhotoId || fallback?.photoId || null,
      representativeFaceBox: profile.representativeFaceBox || fallback?.faceBox || null
    };
  }

  _findProfileRepresentative(profile = {}, faceMemory = {}) {
    const identityIds = Array.isArray(profile.identityIds) ? profile.identityIds : [];
    const identities = identityIds
      .map(identityId => faceMemory.identities?.[identityId])
      .filter(Boolean);
    const embeddingIds = new Set();
    const clusterIds = new Set();
    for (const identity of identities) {
      for (const embeddingId of identity.embeddingIds || []) embeddingIds.add(embeddingId);
      for (const clusterId of identity.clusterIds || []) clusterIds.add(clusterId);
    }

    const candidates = Object.values(faceMemory.embeddings || {})
      .filter(embedding => embedding.photoId && embedding.faceBox)
      .filter(embedding => embeddingIds.has(embedding.id) || identityIds.includes(embedding.identityId));
    if (candidates.length > 0) return this._bestEmbeddingCandidate(candidates);

    const clusterBoxes = [];
    for (const clusterId of clusterIds) {
      const cluster = faceMemory.unknownClusters?.[clusterId];
      if (cluster?.representativeFaceBox) clusterBoxes.push(cluster.representativeFaceBox);
      for (const faceBox of cluster?.faceBoxes || []) clusterBoxes.push(faceBox);
    }
    const box = clusterBoxes.find(item => item?.photoId && Number(item.width) > 0 && Number(item.height) > 0);
    return box ? { photoId: box.photoId, faceBox: box } : null;
  }

  _bestEmbeddingCandidate(candidates = []) {
    const best = candidates
      .slice()
      .sort((left, right) => (right.confidence || 0) - (left.confidence || 0))[0];
    if (!best) return null;
    return {
      photoId: best.photoId,
      faceBox: {
        photoId: best.photoId,
        faceId: best.faceId || null,
        ...best.faceBox,
        imageWidth: best.imageWidth || best.faceBox.imageWidth || null,
        imageHeight: best.imageHeight || best.faceBox.imageHeight || null
      }
    };
  }
}

module.exports = GalleryPeopleExperience;
