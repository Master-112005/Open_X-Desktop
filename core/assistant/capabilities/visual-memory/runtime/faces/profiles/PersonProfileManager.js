'use strict';

const { id, nowIso } = require('../utils/face-utils');

class PersonProfileManager {
  constructor({ state } = {}) {
    this.state = state;
  }

  createProfile({ name, relationship = '', notes = '' } = {}) {
    const profileId = id('personprofile');
    const profile = {
      id: profileId,
      name,
      relationship,
      notes,
      identityIds: [],
      embeddingCount: 0,
      photoCount: 0,
      firstSeenAt: null,
      lastSeenAt: null,
      confidence: 0,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    this.state.profiles[profileId] = profile;
    return profile;
  }

  updateStats(profileId, stats = {}) {
    const profile = this.state.profiles[profileId];
    if (!profile) return null;
    Object.assign(profile, stats, { updatedAt: nowIso() });
    return profile;
  }

  deleteProfile(profileId) {
    const existed = Boolean(this.state.profiles[profileId]);
    delete this.state.profiles[profileId];
    return existed;
  }

  listProfiles() {
    return Object.values(this.state.profiles);
  }
}

module.exports = PersonProfileManager;
