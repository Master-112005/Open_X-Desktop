'use strict';

class FaceRelationshipManager {
  constructor({ state } = {}) {
    this.state = state;
  }

  setRelationship(identityId, relationship, source = 'assistant-relationship') {
    const identity = this.state.identities[identityId];
    if (!identity) throw new Error('Identity not found.');
    identity.relationship = String(relationship || '').trim();
    this.state.relationships[identityId] = { identityId, relationship: identity.relationship, source, updatedAt: new Date().toISOString() };
    const profile = this.state.profiles[identity.profileId];
    if (profile) profile.relationship = identity.relationship;
    return this.state.relationships[identityId];
  }

  getRelationship(identityId) {
    return this.state.relationships[identityId] || null;
  }
}

module.exports = FaceRelationshipManager;
