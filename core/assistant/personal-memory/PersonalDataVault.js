'use strict';

const crypto = require('crypto');
const path = require('path');
const {
  ensureDataRoot,
  readSecureJsonFile: readJsonFile,
  writeSecureJsonAtomic: writeJsonAtomic
} = require('../Data');
const PersonalMemoryEncryption = require('./PersonalMemoryEncryption');

const VAULT_VERSION = 1;

function nowIso(clock = null) {
  return typeof clock === 'function' ? clock() : new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(16).toString('hex')}`;
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9\s._-]/g, '').replace(/\s+/g, ' ');
}

function defaultVault(clock = null) {
  const createdAt = nowIso(clock);
  return {
    version: VAULT_VERSION,
    people: {},
    contactMethods: {},
    relationships: {},
    indexes: {
      peopleByName: {},
      contactByHash: {}
    },
    metadata: {
      createdAt,
      updatedAt: null,
      people: 0,
      contactMethods: 0,
      relationships: 0
    }
  };
}

class PersonalDataVault {
  constructor(options = {}) {
    this.config = options.config || {};
    this.clock = typeof options.clock === 'function' ? options.clock : () => new Date().toISOString();
    const paths = ensureDataRoot(this.config);
    this.filePath = path.resolve(options.filePath || paths.personalVaultPath);
    this.vaultKeyPath = options.vaultKeyPath || paths.dataEncryptionKeyPath;
    this.encryption = options.encryption || new PersonalMemoryEncryption({
      config: this.config,
      keyPath: options.keyPath || paths.personalVaultKeyPath
    });
    this.data = this._read();
  }

  upsertPerson(person = {}) {
    const timestamp = nowIso(this.clock);
    const displayName = String(person.displayName || person.display_name || '').trim().replace(/\s+/g, ' ');
    const normalizedName = normalizeName(displayName);
    if (!normalizedName) return null;
    const existingId = this.data.indexes.peopleByName[normalizedName];
    const personId = existingId || person.id || id('person');
    const existing = this.data.people[personId] || {};
    const record = {
      id: personId,
      displayName,
      preferredName: String(person.preferredName || person.preferred_name || existing.preferredName || displayName).trim(),
      birthday: person.birthday || existing.birthday || null,
      notesEncrypted: person.notes ? this.encryption.encrypt(person.notes) : existing.notesEncrypted || null,
      source: person.source || existing.source || 'explicit_user_statement',
      confidence: this._confidence(person.confidence, existing.confidence, 0.95),
      confirmed: person.confirmed === true || existing.confirmed === true,
      createdAt: existing.createdAt || timestamp,
      updatedAt: timestamp
    };
    this.data.people[personId] = record;
    this.data.indexes.peopleByName[normalizedName] = personId;
    this._updateMetadata(timestamp);
    this._write();
    return this.getPerson(personId, { revealSensitive: false });
  }

  addContactMethod(personId, method = {}) {
    if (!this.data.people[personId]) return null;
    const timestamp = nowIso(this.clock);
    const value = String(method.value || '').trim();
    const type = String(method.type || 'custom').trim().toLowerCase();
    const valueHash = this.encryption.hashValue(`${type}:${value}`);
    const existingId = this.data.indexes.contactByHash[valueHash];
    const contactId = existingId || method.id || id('contact');
    const existing = this.data.contactMethods[contactId] || {};
    const record = {
      id: contactId,
      personId,
      type,
      valueEncrypted: this.encryption.encrypt(value),
      valueHash,
      label: String(method.label || existing.label || type).trim().slice(0, 80),
      isPrimary: method.isPrimary === true || existing.isPrimary === true,
      source: method.source || existing.source || 'explicit_user_statement',
      confidence: this._confidence(method.confidence, existing.confidence, 0.95),
      confirmed: method.confirmed === true || existing.confirmed === true,
      createdAt: existing.createdAt || timestamp,
      updatedAt: timestamp
    };
    this.data.contactMethods[contactId] = record;
    this.data.indexes.contactByHash[valueHash] = contactId;
    this._updateMetadata(timestamp);
    this._write();
    return this.getContactMethod(contactId, { revealSensitive: false });
  }

  addRelationship(personId, relationship = {}) {
    if (!this.data.people[personId]) return null;
    const timestamp = nowIso(this.clock);
    const type = String(relationship.type || relationship.relationshipType || 'custom').trim().toLowerCase();
    const existing = Object.values(this.data.relationships).find(item => item.personId === personId && item.relationshipType === type);
    const relationshipId = existing?.id || relationship.id || id('relationship');
    const record = {
      id: relationshipId,
      personId,
      relationshipType: type,
      relationshipLabel: String(relationship.label || relationship.relationshipLabel || type).trim().slice(0, 80),
      confidence: this._confidence(relationship.confidence, existing?.confidence, 0.95),
      confirmed: relationship.confirmed === true || existing?.confirmed === true,
      source: relationship.source || existing?.source || 'explicit_user_statement',
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp
    };
    this.data.relationships[relationshipId] = record;
    this._updateMetadata(timestamp);
    this._write();
    return { ...record };
  }

  findPersonByName(name) {
    const personId = this.data.indexes.peopleByName[normalizeName(name)];
    return personId ? this.getPerson(personId, { revealSensitive: false }) : null;
  }

  findPeopleByRelationship(type) {
    const normalized = String(type || '').trim().toLowerCase();
    return Object.values(this.data.relationships)
      .filter(relationship => relationship.relationshipType === normalized)
      .map(relationship => this.getPerson(relationship.personId, { revealSensitive: false }))
      .filter(Boolean);
  }

  getPerson(personId, options = {}) {
    const person = this.data.people[personId];
    if (!person) return null;
    const contacts = Object.values(this.data.contactMethods)
      .filter(method => method.personId === personId)
      .map(method => this._publicContact(method, options));
    const relationships = Object.values(this.data.relationships)
      .filter(relationship => relationship.personId === personId)
      .map(relationship => ({ ...relationship }));
    return {
      id: person.id,
      displayName: person.displayName,
      preferredName: person.preferredName,
      birthday: person.birthday,
      notes: options.revealSensitive && person.notesEncrypted ? this.encryption.decrypt(person.notesEncrypted) : undefined,
      source: person.source,
      confidence: person.confidence,
      confirmed: person.confirmed,
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
      contactMethods: contacts,
      relationships
    };
  }

  getContactMethod(contactId, options = {}) {
    const method = this.data.contactMethods[contactId];
    return method ? this._publicContact(method, options) : null;
  }

  listPeople(options = {}) {
    return Object.keys(this.data.people)
      .map(personId => this.getPerson(personId, options))
      .filter(Boolean)
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  }

  snapshot(options = {}) {
    return {
      path: this.filePath,
      people: this.listPeople(options),
      metadata: { ...this.data.metadata }
    };
  }

  clear() {
    this.data = defaultVault(this.clock);
    this._write();
    return true;
  }

  _publicContact(method, options = {}) {
    return {
      id: method.id,
      personId: method.personId,
      type: method.type,
      value: options.revealSensitive ? this.encryption.decrypt(method.valueEncrypted) : undefined,
      valueHash: method.valueHash,
      label: method.label,
      isPrimary: method.isPrimary,
      source: method.source,
      confidence: method.confidence,
      confirmed: method.confirmed,
      createdAt: method.createdAt,
      updatedAt: method.updatedAt
    };
  }

  _confidence(incoming, existing, fallback) {
    const value = Number(incoming ?? existing ?? fallback);
    return Math.max(0, Math.min(1, Number.isFinite(value) ? value : fallback));
  }

  _updateMetadata(timestamp) {
    this.data.metadata.updatedAt = timestamp;
    this.data.metadata.people = Object.keys(this.data.people).length;
    this.data.metadata.contactMethods = Object.keys(this.data.contactMethods).length;
    this.data.metadata.relationships = Object.keys(this.data.relationships).length;
  }

  _read() {
    return readJsonFile(this.filePath, () => defaultVault(this.clock), {
      createIfMissing: true,
      config: this.config,
      keyPath: this.vaultKeyPath,
      validate: value => value && value.version === VAULT_VERSION && value.people && value.contactMethods && value.relationships
    });
  }

  _write() {
    writeJsonAtomic(this.filePath, this.data, { backup: true, config: this.config, keyPath: this.vaultKeyPath });
  }
}

module.exports = PersonalDataVault;
