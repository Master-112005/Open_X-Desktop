'use strict';

class ContactRepository {
  constructor(vault) {
    this.vault = vault;
  }

  add(personId, method) {
    return this.vault.addContactMethod(personId, method);
  }

  get(contactId, options = {}) {
    return this.vault.getContactMethod(contactId, options);
  }
}

module.exports = ContactRepository;
