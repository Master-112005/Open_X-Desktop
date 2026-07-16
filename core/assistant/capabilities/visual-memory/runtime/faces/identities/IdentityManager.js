'use strict';

const {
  cosineSimilarity,
  faceBoxIoU,
  id,
  normalizeFaceBox,
  normalizedFaceBoxDistance,
  nowIso
} = require('../utils/face-utils');

class IdentityManager {
  constructor({ state, profiles, embeddings, validator, events, diagnostics } = {}) {
    this.state = state;
    this.profiles = profiles;
    this.embeddings = embeddings;
    this.validator = validator;
    this.events = events;
    this.diagnostics = diagnostics;
  }

  createIdentity({ name, relationship = '', clusterId = null, embeddings = [], notes = '', confirmedBy = 'user' } = {}) {
    const validation = this.validator.validateIdentityName(name);
    if (!validation.valid) throw new Error(validation.reason);
    const identityId = id('faceid');
    const profile = this.profiles.createProfile({ name: validation.name, relationship, notes });
    const identity = {
      id: identityId,
      profileId: profile.id,
      name: validation.name,
      relationship,
      clusterIds: clusterId ? [clusterId] : [],
      embeddingIds: [],
      history: [{ action: 'created', at: nowIso(), by: confirmedBy }],
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    this.state.identities[identityId] = identity;
    profile.identityIds.push(identityId);

    const sourceEmbeddings = embeddings.length
      ? embeddings
      : clusterId ? Object.values(this.state.embeddings).filter(item => item.clusterId === clusterId) : [];
    for (const embedding of sourceEmbeddings) {
      const target = typeof embedding === 'string' ? this.state.embeddings[embedding] : embedding;
      if (!target) continue;
      target.identityId = identityId;
      target.clusterId = target.clusterId || clusterId;
      identity.embeddingIds.push(target.id);
    }
    this._refreshProfile(identityId);
    this.events?.emit?.('visual-memory.faces.identity.created', { identityId, profileId: profile.id, name: validation.name });
    this.diagnostics?.record?.('identity-created', { identityId, name: validation.name, embeddingCount: identity.embeddingIds.length });
    return { identity, profile: this.state.profiles[profile.id] };
  }

  mergeIdentities(sourceId, targetId) {
    const validation = this.validator.validateMerge(sourceId, targetId);
    if (!validation.valid) throw new Error(validation.reason);
    const source = this.state.identities[sourceId];
    const target = this.state.identities[targetId];
    if (!source || !target) throw new Error('Identity not found for merge.');
    target.clusterIds = Array.from(new Set([...(target.clusterIds || []), ...(source.clusterIds || [])]));
    target.embeddingIds = Array.from(new Set([...(target.embeddingIds || []), ...(source.embeddingIds || [])]));
    for (const embeddingId of source.embeddingIds || []) {
      if (this.state.embeddings[embeddingId]) this.state.embeddings[embeddingId].identityId = targetId;
    }
    target.history.push({ action: 'merged', sourceId, at: nowIso() });
    delete this.state.identities[sourceId];
    this.profiles.deleteProfile(source.profileId);
    this._refreshProfile(targetId);
    this.events?.emit?.('visual-memory.faces.identity.merged', { sourceId, targetId });
    return this.state.identities[targetId];
  }

  addClusterToIdentity(clusterId, identityId) {
    const cluster = this.state.unknownClusters?.[clusterId];
    const identity = this.state.identities?.[identityId];
    if (!cluster) throw new Error('Unknown face cluster not found.');
    if (!identity) throw new Error('Target identity not found.');

    const clusterEmbeddings = Object.values(this.state.embeddings || {})
      .filter(item => item.clusterId === clusterId);
    if (clusterEmbeddings.length === 0) throw new Error('No face embeddings found for this cluster.');

    identity.clusterIds = Array.from(new Set([...(identity.clusterIds || []), clusterId]));
    identity.embeddingIds = Array.from(new Set([
      ...(identity.embeddingIds || []),
      ...clusterEmbeddings.map(item => item.id)
    ]));
    identity.history = Array.isArray(identity.history) ? identity.history : [];
    identity.history.push({ action: 'cluster-added', clusterId, at: nowIso(), by: 'user-correction' });
    identity.updatedAt = nowIso();

    for (const embedding of clusterEmbeddings) {
      embedding.identityId = identityId;
      embedding.clusterId = clusterId;
    }
    cluster.status = 'enrolled';
    cluster.identityId = identityId;
    cluster.addedToIdentityAt = nowIso();

    const profile = this._refreshProfile(identityId);
    this.events?.emit?.('visual-memory.faces.cluster.assigned', { clusterId, identityId });
    this.diagnostics?.record?.('cluster-assigned-to-identity', {
      clusterId,
      identityId,
      embeddingCount: clusterEmbeddings.length
    });
    return { identity: this.state.identities[identityId], profile };
  }

  addEmbeddingToIdentity(identityId, input = {}, options = {}) {
    const identity = this.state.identities?.[identityId];
    if (!identity) throw new Error('Target identity not found.');
    const duplicate = this._findDuplicateIdentityEmbedding(identityId, input, options);
    if (duplicate) {
      duplicate.confidence = Math.max(Number(duplicate.confidence) || 0, Number(input.confidence) || 0);
      duplicate.quality = Math.max(Number(duplicate.quality) || 0, Number(input.quality) || 0);
      duplicate.lastMatchedAt = nowIso();
      duplicate.matchCount = Math.max(1, Number(duplicate.matchCount) || 1) + 1;
      const profile = this._refreshProfile(identityId);
      this.diagnostics?.record?.('identity-embedding-duplicate-suppressed', {
        identityId,
        embeddingId: duplicate.id,
        photoId: input.photoId || null
      });
      return { identity, profile, embedding: duplicate, duplicate: true };
    }

    const faceBox = this._normalizeFaceBox(input.faceBox, input.imageWidth, input.imageHeight);
    const embedding = this.embeddings.addEmbedding({
      vector: input.vector,
      identityId,
      clusterId: input.clusterId || null,
      photoId: input.photoId || null,
      faceId: input.faceId || null,
      faceBox,
      imageWidth: faceBox?.imageWidth || input.imageWidth || null,
      imageHeight: faceBox?.imageHeight || input.imageHeight || null,
      source: input.source || options.source || 'ai-vision',
      confidence: input.confidence || 0,
      quality: input.quality
    });
    identity.embeddingIds = Array.from(new Set([...(identity.embeddingIds || []), embedding.id]));
    identity.history = Array.isArray(identity.history) ? identity.history : [];
    identity.history.push({ action: options.action || 'embedding-added', embeddingId: embedding.id, at: nowIso(), by: options.by || 'system' });
    identity.updatedAt = nowIso();
    const profile = this._refreshProfile(identityId);
    this.events?.emit?.('visual-memory.faces.identity.embedding.added', { identityId, embeddingId: embedding.id });
    this.diagnostics?.record?.('identity-embedding-added', {
      identityId,
      embeddingId: embedding.id,
      photoId: embedding.photoId || null,
      duplicate: false
    });
    return { identity, profile, embedding, duplicate: false };
  }

  splitIdentity(identityId, embeddingIds = [], newName = '') {
    const source = this.state.identities[identityId];
    if (!source) throw new Error('Identity not found for split.');
    const moved = embeddingIds.filter(embeddingId => source.embeddingIds.includes(embeddingId));
    if (moved.length === 0) throw new Error('No embeddings selected for split.');
    const name = newName || `${source.name} split`;
    const created = this.createIdentity({ name, relationship: source.relationship, embeddings: moved.map(id => this.state.embeddings[id]), confirmedBy: 'user-split' });
    source.embeddingIds = source.embeddingIds.filter(embeddingId => !moved.includes(embeddingId));
    source.history.push({ action: 'split', targetId: created.identity.id, at: nowIso() });
    this._refreshProfile(identityId);
    this.events?.emit?.('visual-memory.faces.identity.split', { sourceId: identityId, targetId: created.identity.id });
    return created;
  }

  deleteIdentity(identityId) {
    const identity = this.state.identities[identityId];
    if (!identity) return false;
    this.embeddings.deleteForIdentity(identityId);
    this.profiles.deleteProfile(identity.profileId);
    delete this.state.identities[identityId];
    this.events?.emit?.('visual-memory.faces.identity.deleted', { identityId });
    this.diagnostics?.record?.('identity-deleted', { identityId });
    return true;
  }

  listIdentities() {
    return Object.values(this.state.identities);
  }

  _refreshProfile(identityId) {
    const identity = this.state.identities[identityId];
    if (!identity) return null;
    const embeddings = identity.embeddingIds.map(embeddingId => this.state.embeddings[embeddingId]).filter(Boolean);
    const photoIds = Array.from(new Set(embeddings.map(item => item.photoId).filter(Boolean)));
    const dates = embeddings.map(item => Date.parse(item.createdAt)).filter(Boolean).sort((a, b) => a - b);
    const representative = embeddings
      .filter(item => item.photoId)
      .sort((left, right) => (right.confidence || 0) - (left.confidence || 0))[0] || null;
    return this.profiles.updateStats(identity.profileId, {
      embeddingCount: embeddings.length,
      photoCount: photoIds.length,
      representativePhotoId: representative?.photoId || null,
      representativeFaceBox: representative?.faceBox
        ? {
          photoId: representative.photoId,
          faceId: representative.faceId || null,
          ...representative.faceBox,
          imageWidth: representative.imageWidth || representative.faceBox.imageWidth || null,
          imageHeight: representative.imageHeight || representative.faceBox.imageHeight || null
        }
        : null,
      firstSeenAt: dates.length ? new Date(dates[0]).toISOString() : null,
      lastSeenAt: dates.length ? new Date(dates[dates.length - 1]).toISOString() : null,
      confidence: embeddings.reduce((best, item) => Math.max(best, item.confidence || 0), 0)
    });
  }

  _findDuplicateIdentityEmbedding(identityId, input = {}, options = {}) {
    const vector = Array.isArray(input.vector) ? input.vector : [];
    const threshold = Number(options.duplicateThreshold ?? 0.998);
    const crossPhotoThreshold = Number(options.duplicateCrossPhotoThreshold ?? 0.9995);
    const boxThreshold = Number(options.duplicateBoxIoU ?? 0.94);
    const faceBox = this._normalizeFaceBox(input.faceBox, input.imageWidth, input.imageHeight);
    for (const embedding of this.embeddings.listForIdentity(identityId)) {
      if (!input.photoId || !embedding.photoId) continue;
      const similarity = vector.length && Array.isArray(embedding.vector) ? cosineSimilarity(vector, embedding.vector) : 0;
      if (input.photoId === embedding.photoId) {
        if (input.faceId && embedding.faceId && input.faceId === embedding.faceId) return embedding;
        if (faceBox && embedding.faceBox && faceBoxIoU(faceBox, embedding.faceBox) >= boxThreshold) return embedding;
        if (similarity >= threshold) return embedding;
      } else if (similarity >= crossPhotoThreshold &&
        faceBox &&
        embedding.faceBox &&
        normalizedFaceBoxDistance(faceBox, embedding.faceBox) <= 0.018) {
        return embedding;
      }
    }
    return null;
  }

  _normalizeFaceBox(faceBox = null, imageWidth = null, imageHeight = null) {
    return normalizeFaceBox(faceBox, imageWidth, imageHeight);
  }

  _faceBoxIoU(left = {}, right = {}) {
    return faceBoxIoU(left, right);
  }
}

module.exports = IdentityManager;
