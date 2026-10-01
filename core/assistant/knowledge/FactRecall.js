'use strict';

const { RELATION_SYNONYMS } = require('./StatementCapture');

const RELATION_PATTERN = Object.keys(RELATION_SYNONYMS)
  .map(canonical => RELATION_SYNONYMS[canonical])
  .reduce((all, list) => all.concat(list), [])
  .sort((a, b) => b.length - a.length)
  .join('|');

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[?!.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveRelation(word) {
  const lower = String(word || '').toLowerCase().replace(/['’]s$/, '');
  for (const canonical of Object.keys(RELATION_SYNONYMS)) {
    if (RELATION_SYNONYMS[canonical].includes(lower)) {
      return canonical;
    }
  }
  return null;
}

class FactRecall {
  constructor(store) {
    this.store = store || null;
  }

  answer(input) {
    if (!this.store) {
      return null;
    }
    const text = normalize(input);
    if (!text) {
      return null;
    }

    const task = this._classify(text);
    if (!task) {
      return null;
    }

    if (task.type === 'summary') {
      return this._summary();
    }
    if (task.type === 'name') {
      return this._userFact('has_name', 'name', 'What should I call you?');
    }
    if (task.type === 'location') {
      return this._userFact('has_location', 'hometown', 'Where do you live?');
    }
    if (task.type === 'birthday') {
      return this._userFact('date_of_birth', 'birthday', 'When is your birthday?');
    }
    if (task.type === 'relationship') {
      return this._relationship(task.relation);
    }
    return null;
  }

  _classify(text) {
    if (/\b(?:what do you (?:know|remember|have|have saved|know about)\s+(?:about\s+)?me|what have you (?:learned|saved) about me|show (?:me )?my (?:saved )?facts|list my facts)\b/.test(text)) {
      return { type: 'summary' };
    }
    if (/\b(?:who am i|what(?:'s|s| is) my name|do you (?:know|remember) my name|tell me my name|what do you call me)\b/.test(text)) {
      return { type: 'name' };
    }
    if (/\b(?:where do i live|where am i from|what(?:'s|s| is) my (?:hometown|home town|location|city|address)|do you (?:know|remember) (?:where i live|my (?:hometown|home town|location))|tell me my (?:hometown|home town|location))\b/.test(text)) {
      return { type: 'location' };
    }
    if (/\b(?:when is my birthday|what(?:'s|s| is) my birthday|when was i born|do you (?:know|remember) my birthday|tell me my birthday)\b/.test(text)) {
      return { type: 'birthday' };
    }

    const relationMatch = new RegExp(
      `\\b(?:who(?:'s| is)|what(?:'s|s| is))\\s+my\\s+(${RELATION_PATTERN})\\b` +
      `|\\bdo you (?:know|remember)\\s+my\\s+(${RELATION_PATTERN})\\b` +
      `|\\bmy\\s+(${RELATION_PATTERN})(?:'s|s)?\\s+name\\b`,
      'i'
    ).exec(text);
    if (relationMatch) {
      const relation = resolveRelation(relationMatch[1] || relationMatch[2] || relationMatch[3]);
      if (relation) {
        return { type: 'relationship', relation };
      }
    }
    return null;
  }

  _userFact(predicate, label, prompt) {
    const facts = this.store.getAllUserFacts ? this.store.getAllUserFacts() : {};
    const value = facts[`user:${predicate}`];
    const entities = { predicate, label };
    if (value === undefined || value === null || value === '') {
      return {
        intent: 'learning.recall',
        entities,
        data: { known: false, predicate },
        response: `I do not know your ${label} yet. Tell me and I will ask you to confirm before saving it. ${prompt}`
      };
    }
    return {
      intent: 'learning.recall',
      entities: { ...entities, value },
      data: { known: true, predicate, value },
      response: `Your ${label} is "${value}".`
    };
  }

  _relationship(relation) {
    const facts = (this.store.findFacts ? this.store.findFacts(relation, 'has_name') : [])
      .filter(fact => fact.user_confirmed);
    if (facts.length === 0) {
      return {
        intent: 'learning.recall',
        entities: { relation },
        data: { known: false, relation },
        response: `I do not know about your ${relation} yet. Tell me "${relation} is ..." and I will ask you to confirm before saving it.`
      };
    }
    const name = facts[0].object;
    return {
      intent: 'learning.recall',
      entities: { relation, value: name },
      data: { known: true, relation, value: name },
      response: `Your ${relation} is named "${name}".`
    };
  }

  _summary() {
    const facts = (this.store.listFacts ? this.store.listFacts({ confirmed: true }) : [])
      .filter(fact => fact.user_confirmed);
    const phrases = [];
    for (const fact of facts) {
      if (phrases.length >= 6) {
        break;
      }
      phrases.push(this._phrase(fact));
    }
    if (phrases.length === 0) {
      return {
        intent: 'learning.recall',
        entities: {},
        data: { known: false, count: 0 },
        response: 'I do not have any confirmed facts about you yet. Tell me something like "my name is ..." and I will ask before saving it.'
      };
    }
    return {
      intent: 'learning.recall',
      entities: { count: phrases.length },
      data: { known: true, count: phrases.length },
      response: `Here is what I have saved about you: ${phrases.join('; ')}.`
    };
  }

  _phrase(fact) {
    const object = typeof fact.object === 'object' && fact.object !== null
      ? JSON.stringify(fact.object)
      : String(fact.object);
    if (fact.subject === 'user') {
      if (fact.predicate === 'has_name') return `your name is "${object}"`;
      if (fact.predicate === 'has_location') return `your hometown is "${object}"`;
      if (fact.predicate === 'date_of_birth') return `your birthday is "${object}"`;
      return `your ${String(fact.predicate).replace(/_/g, ' ')} is "${object}"`;
    }
    return `your ${fact.subject} is named "${object}"`;
  }
}

module.exports = FactRecall;
module.exports.normalize = normalize;
module.exports.resolveRelation = resolveRelation;