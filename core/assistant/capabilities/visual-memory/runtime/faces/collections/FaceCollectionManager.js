'use strict';

class FaceCollectionManager {
  constructor({ state } = {}) {
    this.state = state;
  }

  getCollections() {
    const profiles = Object.values(this.state.profiles);
    const byRelationship = new Map();
    for (const profile of profiles) {
      const key = String(profile.relationship || 'unknown').toLowerCase() || 'unknown';
      if (!byRelationship.has(key)) byRelationship.set(key, []);
      byRelationship.get(key).push(profile.id);
    }
    return Array.from(byRelationship.entries()).map(([relationship, profileIds]) => ({
      id: relationship,
      title: relationship === 'unknown' ? 'Unknown' : relationship.replace(/\b\w/g, char => char.toUpperCase()),
      profileIds,
      count: profileIds.length
    }));
  }
}

module.exports = FaceCollectionManager;
