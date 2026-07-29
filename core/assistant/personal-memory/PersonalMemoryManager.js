'use strict';

const PersonalDataVault = require('./PersonalDataVault');
const PersonalMemoryParser = require('./PersonalMemoryParser');
const { PersonalMemoryPolicy } = require('./PersonalMemoryPolicy');
const PersonRepository = require('./PersonRepository');
const ContactRepository = require('./ContactRepository');
const RelationshipRepository = require('./RelationshipRepository');
const PersonalMemorySearch = require('./PersonalMemorySearch');

class PersonalMemoryManager {
  constructor(options = {}) {
    this.vault = options.vault || new PersonalDataVault(options);
    this.parser = options.parser || new PersonalMemoryParser();
    this.policy = options.policy || new PersonalMemoryPolicy();
    this.people = options.people || new PersonRepository(this.vault);
    this.contacts = options.contacts || new ContactRepository(this.vault);
    this.relationships = options.relationships || new RelationshipRepository(this.vault);
    this.searcher = options.searcher || new PersonalMemorySearch({
      personRepository: this.people,
      relationshipRepository: this.relationships
    });
  }

  learnFromText(input) {
    const parsed = this.parser.parse(input);
    if (!parsed) return null;

    const peopleByName = new Map();
    const changed = new Set(parsed.safeFieldsChanged || []);

    for (const person of parsed.people) {
      const checked = this.policy.validatePerson(person);
      if (!checked.valid) continue;
      const saved = this.people.upsert(checked.person);
      if (saved) peopleByName.set(saved.displayName.toLowerCase(), saved);
    }

    for (const relationship of parsed.relationships) {
      const person = peopleByName.get(String(relationship.displayName || '').toLowerCase()) ||
        this.people.findByName(relationship.displayName);
      if (!person) continue;
      const checked = this.policy.validateRelationship(relationship);
      if (!checked.valid) continue;
      this.relationships.add(person.id, checked.relationship);
      changed.add('relationship');
    }

    for (const method of parsed.contactMethods) {
      const person = peopleByName.get(String(method.displayName || '').toLowerCase()) ||
        this.people.findByName(method.displayName);
      if (!person) continue;
      const checked = this.policy.validateContactMethod(method);
      if (!checked.valid) continue;
      this.contacts.add(person.id, checked.method);
      changed.add(checked.method.type);
    }

    const people = [...peopleByName.values()];
    if (!people.length) return null;
    return {
      type: 'personal-memory',
      learned: true,
      people: people.map(person => ({
        personId: person.id,
        displayName: person.displayName,
        confidence: person.confidence,
        confirmed: person.confirmed
      })),
      safeLearningEvent: {
        event: 'personal_memory_updated',
        personIds: people.map(person => person.id),
        fieldsChanged: [...changed].sort()
      }
    };
  }

  search(query, options = {}) {
    return this.searcher.search(query, options);
  }

  getPerson(personId, options = {}) {
    return this.people.get(personId, options);
  }

  listPeople(options = {}) {
    return this.people.list(options);
  }

  snapshot(options = {}) {
    return this.vault.snapshot(options);
  }

  clear() {
    return this.vault.clear();
  }
}

module.exports = PersonalMemoryManager;
