'use strict';

const DEFAULT_MIN_NAMEABLE_PHOTOS = 2;
const DEFAULT_SUGGESTION_CONFIDENCE = 0.78;
const MAX_NAMEABLE_UNKNOWN = 96;

class GalleryPeopleExperience {
  build(faceMemory = {}) {
    const profiles = Object.values(faceMemory.profiles || {})
      .map(profile => this._profileWithRepresentative(profile, faceMemory))
      .sort((left, right) => (right.photoCount || 0) - (left.photoCount || 0));
    const allUnknown = Object.values(faceMemory.unknownClusters || {})
      .filter(cluster => cluster.status === 'unknown' && !cluster.neverAskAgain && !cluster.ignoredAt);
    const minNameablePhotos = this._minNameablePhotos(faceMemory);
    const suggestionConfidence = this._suggestionConfidence(faceMemory);
    const sortedUnknown = allUnknown
      .slice()
      .sort((left, right) => this._sortUnknownClusters(left, right));
    const nameableUnknown = sortedUnknown.slice(0, MAX_NAMEABLE_UNKNOWN).map(cluster => this._unknownClusterView(cluster, {
      nameable: true,
      status: 'ready-to-name',
      reason: 'Clear face found during People scan.'
    }));
    const relationshipGroups = {};
    for (const profile of profiles) {
      const key = profile.relationship || 'people';
      if (!relationshipGroups[key]) relationshipGroups[key] = [];
      relationshipGroups[key].push(profile.id);
    }
    return {
      view: 'people',
      known: profiles,
      unknown: nameableUnknown,
      reviewLater: [],
      summary: {
        totalPeople: profiles.length + allUnknown.length,
        namedPeople: profiles.length,
        savedPeople: profiles.length,
        unnamedPeople: allUnknown.length,
        readyToName: allUnknown.length,
        displayedReadyToName: nameableUnknown.length,
        waitingForEvidence: 0,
        reviewLater: 0,
        hiddenReviewPeople: Math.max(0, allUnknown.length - nameableUnknown.length),
        minNameablePhotos,
        suggestionConfidence
      },
      relationshipGroups,
      performsRecognition: false
    };
  }

  _unknownClusterView(cluster = {}, options = {}) {
    const photoIds = Array.isArray(cluster.photoIds) ? cluster.photoIds.filter(Boolean) : [];
    return {
      clusterId: cluster.id,
      label: 'Unnamed person',
      nameable: options.nameable === true,
      status: options.status || 'unknown',
      reason: options.reason || '',
      photoCount: photoIds.length,
      representativePhotoId: photoIds[0] || null,
      representativeFaceBox: cluster.representativeFaceBox || cluster.faceBoxes?.[0] || null,
      photoIds: photoIds.slice(0, 12),
      firstSeenAt: cluster.firstSeenAt,
      latestSeenAt: cluster.latestSeenAt,
      confidence: this._unknownConfidence(cluster)
    };
  }

  _sortUnknownClusters(left = {}, right = {}) {
    return this._unknownPhotoCount(right) - this._unknownPhotoCount(left)
      || this._unknownConfidence(right) - this._unknownConfidence(left)
      || this._timestamp(right.latestSeenAt || right.firstSeenAt) - this._timestamp(left.latestSeenAt || left.firstSeenAt);
  }

  _unknownPhotoCount(cluster = {}) {
    if (Array.isArray(cluster.photoIds)) return cluster.photoIds.filter(Boolean).length;
    return 0;
  }

  _unknownConfidence(cluster = {}) {
    const confidence = Number(cluster.confidence);
    return Number.isFinite(confidence) ? confidence : 0;
  }

  _minNameablePhotos(faceMemory = {}) {
    const configured = Number(faceMemory.configuration?.enrollment?.minUnknownPhotos);
    return Math.max(DEFAULT_MIN_NAMEABLE_PHOTOS, Number.isFinite(configured) ? configured : DEFAULT_MIN_NAMEABLE_PHOTOS);
  }

  _suggestionConfidence(faceMemory = {}) {
    const configured = Number(faceMemory.configuration?.thresholds?.suggestion);
    return Math.max(0, Math.min(1, Number.isFinite(configured) ? configured : DEFAULT_SUGGESTION_CONFIDENCE));
  }

  _timestamp(value) {
    const timestamp = Date.parse(value || '');
    return Number.isFinite(timestamp) ? timestamp : 0;
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
