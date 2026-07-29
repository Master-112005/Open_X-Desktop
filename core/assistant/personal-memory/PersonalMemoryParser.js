'use strict';

const { normalizeRelationship, normalizeContactType } = require('./PersonalMemoryPolicy');

const RELATIONSHIP_WORDS = [
  'father',
  'dad',
  'daddy',
  'papa',
  'appa',
  'mother',
  'mom',
  'mummy',
  'mum',
  'amma',
  'brother',
  'sister',
  'wife',
  'husband',
  'son',
  'daughter',
  'grandfather',
  'grandpa',
  'grandmother',
  'grandma',
  'friend',
  'colleague',
  'manager',
  'doctor'
];

function cleanName(value) {
  const cleaned = String(value || '')
    .replace(/\b(?:remember|that|this|his|her|their|my)\b/gi, ' ')
    .replace(/[^a-zA-Z0-9 ._-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  return cleaned.split(' ').map(part => part ? part[0].toUpperCase() + part.slice(1) : part).join(' ');
}

function sentenceParts(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/[;]+|[.?!]\s+|\band\b/i)
    .map(part => part.trim())
    .filter(Boolean);
}

class PersonalMemoryParser {
  parse(input) {
    const text = String(input || '').trim();
    if (!text) return null;

    const result = {
      people: [],
      relationships: [],
      contactMethods: [],
      safeFieldsChanged: []
    };

    let currentPersonName = null;
    const relationshipPattern = new RegExp(`\\b([a-zA-Z][a-zA-Z0-9 ._-]{1,60}?)\\s+(?:is|=)\\s+my\\s+(${RELATIONSHIP_WORDS.join('|')})\\b`, 'i');
    const reverseRelationshipPattern = new RegExp(`\\bmy\\s+(${RELATIONSHIP_WORDS.join('|')})\\s+(?:is|=)\\s+([a-zA-Z][a-zA-Z0-9 ._-]{1,60})\\b`, 'i');

    for (const part of sentenceParts(text)) {
      const direct = part.match(relationshipPattern);
      const reverse = part.match(reverseRelationshipPattern);
      if (direct || reverse) {
        const displayName = cleanName(direct ? direct[1] : reverse[2]);
        const relationshipType = normalizeRelationship(direct ? direct[2] : reverse[1]);
        if (displayName) {
          currentPersonName = displayName;
          result.people.push({
            displayName,
            source: 'explicit_user_statement',
            confidence: 0.95,
            confirmed: true
          });
          result.relationships.push({
            displayName,
            type: relationshipType,
            label: direct ? direct[2] : reverse[1],
            source: 'explicit_user_statement',
            confidence: 0.95,
            confirmed: true
          });
          result.safeFieldsChanged.push('relationship');
        }
      }
    }

    const selfEmail = text.match(/\bmy\s+(gmail|email|work email)\s+(?:is|=)\s+([^\s,;]+@[^\s,;]+\.[^\s,;]+)/i);
    const selfPhone = text.match(/\bmy\s+(?:phone|mobile|mobile number|phone number)\s+(?:is|=)\s+(\+?[\d\s().-]{7,24})/i);
    if (selfEmail) {
      const type = normalizeContactType(selfEmail[1]);
      result.people.push({ displayName: 'Me', preferredName: 'Me', source: 'explicit_user_statement', confidence: 1, confirmed: true });
      result.contactMethods.push({
        displayName: 'Me',
        type,
        value: selfEmail[2],
        label: type,
        isPrimary: type === 'gmail' || type === 'email',
        source: 'explicit_user_statement',
        confidence: 1,
        confirmed: true
      });
      result.safeFieldsChanged.push(type);
    }
    if (selfPhone) {
      result.people.push({ displayName: 'Me', preferredName: 'Me', source: 'explicit_user_statement', confidence: 1, confirmed: true });
      result.contactMethods.push({
        displayName: 'Me',
        type: 'phone',
        value: selfPhone[1],
        label: 'phone',
        isPrimary: true,
        source: 'explicit_user_statement',
        confidence: 1,
        confirmed: true
      });
      result.safeFieldsChanged.push('phone');
    }

    for (const part of sentenceParts(text)) {
      const namedEmail = part.match(/\b([a-zA-Z][a-zA-Z0-9 ._-]{1,60}?)'?s?\s+(gmail|email|work email)\s+(?:is|=)\s+([^\s,;]+@[^\s,;]+\.[^\s,;]+)/i);
      const pronounEmail = part.match(/\b(?:his|her|their)\s+(gmail|email|work email)\s+(?:is|=)\s+([^\s,;]+@[^\s,;]+\.[^\s,;]+)/i);
      const namedPhone = part.match(/\b([a-zA-Z][a-zA-Z0-9 ._-]{1,60}?)'?s?\s+(?:phone|mobile|mobile number|phone number)\s+(?:is|=)\s+(\+?[\d\s().-]{7,24})/i);
      const pronounPhone = part.match(/\b(?:his|her|their)\s+(?:phone|mobile|mobile number|phone number)\s+(?:is|=)\s+(\+?[\d\s().-]{7,24})/i);

      if (pronounEmail || namedEmail) {
        const displayName = pronounEmail ? currentPersonName : cleanName(namedEmail[1]);
        const type = normalizeContactType(pronounEmail ? pronounEmail[1] : namedEmail[2]);
        const value = pronounEmail ? pronounEmail[2] : namedEmail[3];
        this._pushContact(result, displayName, type, value);
      }
      if (pronounPhone || namedPhone) {
        const displayName = pronounPhone ? currentPersonName : cleanName(namedPhone[1]);
        const value = pronounPhone ? pronounPhone[1] : namedPhone[2];
        this._pushContact(result, displayName, 'phone', value);
      }
    }

    result.people = this._dedupePeople(result.people);
    result.safeFieldsChanged = [...new Set(result.safeFieldsChanged)];
    return result.people.length || result.contactMethods.length || result.relationships.length ? result : null;
  }

  _pushContact(result, displayName, type, value) {
    const cleanValue = String(value || '').trim().replace(/[,.!?]+$/g, '');
    if (!displayName || !cleanValue) return;
    result.people.push({
      displayName,
      source: 'explicit_user_statement',
      confidence: 0.95,
      confirmed: true
    });
    result.contactMethods.push({
      displayName,
      type,
      value: cleanValue,
      label: type,
      isPrimary: type === 'phone' || type === 'gmail' || type === 'email',
      source: 'explicit_user_statement',
      confidence: 0.95,
      confirmed: true
    });
    result.safeFieldsChanged.push(type);
  }

  _dedupePeople(people) {
    const byName = new Map();
    for (const person of people) {
      const key = String(person.displayName || '').trim().toLowerCase();
      if (!key || byName.has(key)) continue;
      byName.set(key, person);
    }
    return [...byName.values()];
  }
}

module.exports = PersonalMemoryParser;
