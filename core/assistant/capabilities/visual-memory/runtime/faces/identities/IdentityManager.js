'use strict';

const { id, nowIso } = require('../utils/face-utils');

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
}

module.exports = IdentityManager;
