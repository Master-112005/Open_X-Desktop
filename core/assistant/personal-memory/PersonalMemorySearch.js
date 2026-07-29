'use strict';

const { normalizeRelationship } = require('./PersonalMemoryPolicy');

class PersonalMemorySearch {
  constructor({ personRepository, relationshipRepository } = {}) {
    this.personRepository = personRepository;
    this.relationshipRepository = relationshipRepository;
  }

  search(query, options = {}) {
    const text = String(query || '').trim().toLowerCase();
    if (!text) return [];
    const relationMatch = text.match(/\b(?:father|dad|daddy|mother|mom|mummy|brother|sister|friend|wife|husband|son|daughter|grandfather|grandmother|grandpa|grandma|colleague|manager|doctor)\b/i);
    if (relationMatch && this.relationshipRepository) {
      return this.relationshipRepository.findPeopleByRelationship(normalizeRelationship(relationMatch[0]));
    }
    const people = this.personRepository?.list?.(options) || [];
    return people.filter(person => {
      const name = `${person.displayName || ''} ${person.preferredName || ''}`.toLowerCase();
      return name.includes(text);
    });
  }
}

module.exports = PersonalMemorySearch;
