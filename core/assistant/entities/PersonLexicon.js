'use strict';

const SELF_CANONICAL = 'user';

const SELF_ALIASES = Object.freeze([
  'me',
  'myself',
  'i',
  'mine',
  'my face',
  'self',
  'user',
  'owner'
]);

const RELATIONSHIP_ALIASES = Object.freeze({
  father: ['father', 'dad', 'daddy', 'papa', 'appa', 'baba', 'pitaji'],
  mother: ['mother', 'mom', 'mommy', 'mummy', 'mumma', 'mama', 'amma', 'maa', 'ma'],
  parents: ['parents', 'parent'],
  brother: ['brother', 'bro', 'anna', 'bhai'],
  sister: ['sister', 'sis', 'akka', 'didi'],
  grandfather: ['grandfather', 'grandpa', 'thatha', 'nana', 'dada'],
  grandmother: ['grandmother', 'grandma', 'paati', 'nani', 'dadi'],
  uncle: ['uncle', 'mama uncle', 'chacha', 'kaka'],
  aunt: ['aunt', 'aunty', 'auntie', 'chachi', 'mami'],
  cousin: ['cousin'],
  wife: ['wife'],
  husband: ['husband'],
  child: ['child', 'kid', 'son', 'daughter'],
  children: ['children', 'kids'],
  friend: ['friend', 'best friend', 'buddy'],
  friends: ['friends'],
  colleague: ['colleague', 'coworker', 'co worker', 'teammate'],
  classmate: ['classmate'],
  teacher: ['teacher', 'sir', 'madam', 'maam'],
  boss: ['boss', 'manager'],
  customer: ['customer', 'client'],
  family: ['family', 'family member']
});

const RELATIONSHIP_LOOKUP = Object.freeze(Object.entries(RELATIONSHIP_ALIASES).reduce((lookup, [canonical, aliases]) => {
  lookup[normalizeToken(canonical)] = canonical;
  for (const alias of aliases) lookup[normalizeToken(alias)] = canonical;
  return lookup;
}, {}));

const RELATIONSHIP_TERMS = Object.freeze(Object.keys(RELATIONSHIP_LOOKUP));

const RELATIONSHIP_GROUPS = Object.freeze({
  parents: ['parents', 'father', 'mother'],
  parent: ['parents', 'father', 'mother'],
  children: ['children', 'child'],
  kids: ['children', 'child'],
  friends: ['friends', 'friend'],
  family: [
    'family',
    'father',
    'mother',
    'parents',
    'brother',
    'sister',
    'grandfather',
    'grandmother',
    'uncle',
    'aunt',
    'cousin',
    'wife',
    'husband',
    'child',
    'children'
  ]
});

function normalizeToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isSelfReference(value) {
  const normalized = normalizeToken(value);
  return SELF_ALIASES.some(alias => normalizeToken(alias) === normalized);
}

function normalizePersonReference(value) {
  if (isSelfReference(value)) return SELF_CANONICAL;
  return String(value || '').trim();
}

function normalizeRelationship(value) {
  return RELATIONSHIP_LOOKUP[normalizeToken(value)] || '';
}

function isRelationshipTerm(value) {
  return Boolean(normalizeRelationship(value));
}

function relationshipAliasesFor(value) {
  const canonical = normalizeRelationship(value) || normalizeToken(value);
  return Array.from(new Set([canonical, ...(RELATIONSHIP_ALIASES[canonical] || [])].map(normalizeToken).filter(Boolean)));
}

function allRelationshipTerms() {
  return RELATIONSHIP_TERMS.slice();
}

function findSelfReferences(text) {
  const source = String(text || '');
  const found = [];
  const patterns = [
    /\b(?:of|with|beside|near|around)\s+(me|myself|self)\b/gi,
    /\b(?:me|myself|self)\s+(?:and|with|beside|near|around|at|in|inside|outside)\b/gi,
    /\bi\s+(?:was|am|m|were)?\s*(?:with|beside|near|around|at|in|inside|outside)\b/gi,
    /\b(?:only|just)\s+me\b/gi,
    /\bmy\s+(?:face|selfie|portrait)\b/gi,
    /\bmy\s+(?:photo|photos|picture|pictures|pic|pics|image|images)\s+(?:with|and|of)\b/gi
  ];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source))) {
      found.push({ value: SELF_CANONICAL, raw: match[0], index: match.index });
    }
  }
  return found;
}

function findRelationshipMentions(text) {
  const source = String(text || '');
  const aliases = allRelationshipTerms().sort((left, right) => right.length - left.length);
  const found = [];
  for (const alias of aliases) {
    const pattern = new RegExp(`\\b(?:my\\s+|our\\s+)?${escapeRegex(alias)}\\b`, 'gi');
    let match;
    while ((match = pattern.exec(source))) {
      const canonical = normalizeRelationship(alias);
      if (canonical) found.push({ value: canonical, raw: match[0], alias, index: match.index });
    }
  }
  const seen = new Set();
  return found.filter(item => {
    const key = `${item.value}:${item.index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchesSelfValue(value) {
  return isSelfReference(value) || normalizeToken(value) === SELF_CANONICAL;
}

function personValuesMatch(available, requested) {
  const normalizedRequested = normalizeToken(requested);
  const normalizedAvailable = normalizeToken(available);
  if (!normalizedRequested || !normalizedAvailable) return false;
  if (normalizedRequested === SELF_CANONICAL) return matchesSelfValue(normalizedAvailable);
  return normalizedAvailable === normalizedRequested;
}

function relationshipValuesMatch(available, requested) {
  const requestedCanonical = normalizeRelationship(requested) || normalizeToken(requested);
  const availableCanonical = normalizeRelationship(available) || normalizeToken(available);
  if (!requestedCanonical || !availableCanonical) return false;
  if (requestedCanonical === availableCanonical) return true;
  const requestedGroup = RELATIONSHIP_GROUPS[requestedCanonical] || [requestedCanonical];
  const availableGroup = RELATIONSHIP_GROUPS[availableCanonical] || [availableCanonical];
  return requestedGroup.includes(availableCanonical) || availableGroup.includes(requestedCanonical);
}

function textMentionsPerson(text, requested) {
  const normalized = normalizeToken(text);
  const target = normalizeToken(requested);
  if (!normalized || !target) return false;
  if (target === SELF_CANONICAL) {
    return SELF_ALIASES.some(alias => new RegExp(`\\b${escapeRegex(normalizeToken(alias))}\\b`).test(normalized));
  }
  return new RegExp(`\\b${escapeRegex(target)}\\b`).test(normalized);
}

function textMentionsRelationship(text, requested) {
  const normalized = normalizeToken(text);
  return relationshipAliasesFor(requested).some(alias => new RegExp(`\\b${escapeRegex(alias)}\\b`).test(normalized));
}

module.exports = {
  SELF_CANONICAL,
  SELF_ALIASES,
  RELATIONSHIP_ALIASES,
  allRelationshipTerms,
  findRelationshipMentions,
  findSelfReferences,
  isRelationshipTerm,
  isSelfReference,
  matchesSelfValue,
  normalizePersonReference,
  normalizeRelationship,
  normalizeToken,
  personValuesMatch,
  relationshipAliasesFor,
  relationshipValuesMatch,
  textMentionsPerson,
  textMentionsRelationship
};
