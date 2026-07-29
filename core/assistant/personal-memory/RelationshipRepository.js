'use strict';

class RelationshipRepository {
  constructor(vault) {
    this.vault = vault;
  }

  add(personId, relationship) {
    return this.vault.addRelationship(personId, relationship);
  }

  findPeopleByRelationship(type) {
    return this.vault.findPeopleByRelationship(type);
  }
}

module.exports = RelationshipRepository;
