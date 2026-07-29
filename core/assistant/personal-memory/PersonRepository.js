'use strict';

class PersonRepository {
  constructor(vault) {
    this.vault = vault;
  }

  upsert(person) {
    return this.vault.upsertPerson(person);
  }

  get(personId, options = {}) {
    return this.vault.getPerson(personId, options);
  }

  findByName(name) {
    return this.vault.findPersonByName(name);
  }

  list(options = {}) {
    return this.vault.listPeople(options);
  }
}

module.exports = PersonRepository;
