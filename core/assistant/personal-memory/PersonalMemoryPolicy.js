'use strict';

const LearningGuard = require('../learning/LearningGuard');

const RELATIONSHIPS = new Set([
  'father',
  'mother',
  'brother',
  'sister',
  'wife',
  'husband',
  'son',
  'daughter',
  'grandfather',
  'grandmother',
  'friend',
  'colleague',
  'manager',
  'doctor',
  'custom'
]);

const RELATIONSHIP_ALIASES = Object.freeze({
  dad: 'father',
  daddy: 'father',
  papa: 'father',
  appa: 'father',
  mom: 'mother',
  mummy: 'mother',
  mum: 'mother',
  amma: 'mother',
  grandma: 'grandmother',
  granny: 'grandmother',
  grandpa: 'grandfather'
});

const CONTACT_TYPES = new Set([
  'phone',
  'mobile',
  'home_phone',
  'work_phone',
  'email',
  'gmail',
  'work_email',
  'custom'
]);

function normalizeRelationship(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z_ -]/g, '').replace(/\s+/g, '_');
  return RELATIONSHIP_ALIASES[normalized] || (RELATIONSHIPS.has(normalized) ? normalized : 'custom');
}

function normalizeContactType(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z_ -]/g, '').replace(/\s+/g, '_');
  if (normalized === 'mail') return 'email';
  if (normalized === 'e_mail') return 'email';
  if (normalized === 'mobile_number') return 'mobile';
  return CONTACT_TYPES.has(normalized) ? normalized : 'custom';
}

class PersonalMemoryPolicy {
  validatePerson(person = {}) {
    const displayName = String(person.displayName || person.display_name || '').trim().replace(/\s+/g, ' ');
    if (displayName.length < 2 || displayName.length > 80) {
      return { valid: false, reason: 'Person name must be 2-80 characters.' };
    }
    const guard = LearningGuard.isAllowedLearning('preference', 'personal-memory-person', displayName);
    if (!guard.allowed) return { valid: false, reason: guard.reason };
    return { valid: true, person: { ...person, displayName } };
  }

  validateContactMethod(method = {}) {
    const type = normalizeContactType(method.type);
    const value = String(method.value || '').trim();
    if (!value || value.length > 180) {
      return { valid: false, reason: 'Contact value is empty or too long.' };
    }
    if (type === 'gmail' && !/^[^\s@]+@gmail\.com$/i.test(value)) {
      return { valid: false, reason: 'Gmail address is invalid.' };
    }
    if ((type === 'email' || type === 'work_email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value)) {
      return { valid: false, reason: 'Email address is invalid.' };
    }
    if ((type === 'phone' || type === 'mobile' || type === 'home_phone' || type === 'work_phone') && !/^\+?[\d\s().-]{7,24}$/.test(value)) {
      return { valid: false, reason: 'Phone number is invalid.' };
    }
    return { valid: true, method: { ...method, type, value } };
  }

  validateRelationship(relationship = {}) {
    const type = normalizeRelationship(relationship.type || relationship.relationshipType);
    const label = String(relationship.label || relationship.relationshipLabel || relationship.type || type).trim().slice(0, 80);
    return { valid: true, relationship: { ...relationship, type, label } };
  }

  rejectOrdinaryLearningValue(value) {
    return LearningGuard.isAllowedLearning('preference', 'personal-memory-safe-event', String(value || ''));
  }
}

module.exports = {
  PersonalMemoryPolicy,
  normalizeRelationship,
  normalizeContactType,
  RELATIONSHIPS,
  CONTACT_TYPES
};
