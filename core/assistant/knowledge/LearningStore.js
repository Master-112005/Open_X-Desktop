'use strict';

const fs = require('fs');
const path = require('path');
const Data = require('../Data');
const AuditLog = require('./audit-log');
const {
  DOMAIN_CONFIG,
  MODELING_DOMAINS,
  createFact,
  applyReinforcement,
  applyDecay,
  supersedeRecord,
  validateStoredRecord,
  makeFactId,
  isKnownDomain
} = require('./fact-model');

const STORE_FORMAT = 'OPENX_LEARNING_FACTS_V1';
const SUPPORTED_SCHEMA_VERSION = 1;
const MAX_PENDING_FACTS = 500;

function emptyPayload() {
  return {
    format: STORE_FORMAT,
    version: 1,
    updatedAt: new Date().toISOString(),
    nextFactId: 1,
    facts: []
  };
}

function cloneFact(record) {
  if (!record) return record;
  return {
    ...record,
    attributes: { ...(record.attributes || {}) },
    history: Array.isArray(record.history)
      ? record.history.map(entry => ({ ...entry }))
      : []
  };
}

class LearningStore {
  constructor(config = {}) {
    this.config = config || {};
    const paths = Data.buildDataPaths(this.config);
    this.root = path.resolve(this.config.learning?.root || paths.learningDir);
    this.keyPath = path.resolve(
      this.config.learning?.keyPath || paths.dataEncryptionKeyPath
    );
    this.factsDbPath = path.join(this.root, 'facts.db.enc');
    this.schemaPath = path.join(this.root, 'facts.schema.json');
    this.auditPath = path.join(this.root, 'audit.log');
    this.pendingPath = path.join(this.root, 'pending-review.json');
    this.audit = new AuditLog(this.auditPath);
    this._facts = [];
    this._nextFactId = 1;
    this._pending = [];
    this._initialized = false;
  }

  _dataOptions(filePath) {
    return {
      config: this.config,
      keyPath: this.keyPath,
      filePath
    };
  }

  _allocateFactId() {
    const id = makeFactId(this._nextFactId);
    this._nextFactId += 1;
    return id;
  }

  _normalizeLoadedFacts(payload) {
    const facts = [];
    let dropped = 0;
    for (const candidate of payload.facts) {
      const problems = validateStoredRecord(candidate);
      if (!problems) {
        facts.push(cloneFact(candidate));
      } else {
        dropped += 1;
      }
    }
    const nextFromIds = facts.reduce((maxId, fact) => {
      const match = /^fact_(\d+)$/.exec(String(fact.id || ''));
      return match ? Math.max(maxId, Number(match[1])) : maxId;
    }, 0);
    const payloadNext = Math.max(1, Number(payload.nextFactId) || 1);
    this._facts = facts;
    this._nextFactId = Math.max(payloadNext, nextFromIds + 1);
    return dropped;
  }

  initialize() {
    fs.mkdirSync(this.root, { recursive: true, mode: 0o700 });
    try { fs.chmodSync(this.root, 0o700); } catch (_) {}

    this.audit.ensure();
    this._ensureSchemaMarker();

    const payload = Data.readSecureJsonFile(
      this.factsDbPath,
      emptyPayload,
      {
        ...this._dataOptions(this.factsDbPath),
        validate: value => Boolean(value && Array.isArray(value.facts))
      }
    );
    if (payload && payload.format && payload.format !== STORE_FORMAT) {
      throw new Error(`Unsupported learning store format: ${payload.format}`);
    }
    const dropped = this._normalizeLoadedFacts(payload);

    this._pending = Data.readSecureJsonFile(
      this.pendingPath,
      () => [],
      {
        ...this._dataOptions(this.pendingPath),
        validate: Array.isArray
      }
    );
    this._pending = this._pending
      .filter(candidate => validateStoredRecord(candidate) === null)
      .slice(0, MAX_PENDING_FACTS);

    this._initialized = true;
    if (dropped > 0) {
      this._persist();
    }
    return this;
  }

  _ensureSchemaMarker() {
    if (fs.existsSync(this.schemaPath)) {
      let marker = null;
      try {
        marker = JSON.parse(fs.readFileSync(this.schemaPath, 'utf8'));
      } catch (_) {
        marker = null;
      }
      if (marker && Number(marker.schemaVersion) > SUPPORTED_SCHEMA_VERSION) {
        throw new Error(`Unsupported learning schema version: ${marker.schemaVersion}`);
      }
      return;
    }
    Data.writeJsonAtomic(this.schemaPath, {
      format: STORE_FORMAT,
      schemaVersion: SUPPORTED_SCHEMA_VERSION,
      domains: Object.keys(DOMAIN_CONFIG),
      createdAt: new Date().toISOString()
    });
  }

  _persist() {
    Data.writeSecureJsonAtomic(this.factsDbPath, {
      format: STORE_FORMAT,
      version: 1,
      updatedAt: new Date().toISOString(),
      nextFactId: this._nextFactId,
      facts: this._facts
    }, this._dataOptions(this.factsDbPath));
  }

  _persistPending() {
    Data.writeSecureJsonAtomic(this.pendingPath, this._pending, this._dataOptions(this.pendingPath));
  }

  _deniedThirdPartyModel(record) {
    if (record.subject === 'user') {
      return null;
    }
    if (MODELING_DOMAINS.includes(record.domain)) {
      return {
        success: false,
        error: `Cannot build ${record.domain} models about anyone other than the primary user`
      };
    }
    return null;
  }

  addFact(input = {}, options = {}) {
    if (!this._initialized) {
      return { success: false, error: 'store_not_initialized' };
    }
    if (!input || typeof input !== 'object') {
      return { success: false, error: 'fact_input_required' };
    }
    let record;
    try {
      record = createFact({ ...input, id: this._allocateFactId() });
    } catch (error) {
      return { success: false, error: error.message };
    }
    const denied = this._deniedThirdPartyModel(record);
    if (denied) {
      return denied;
    }
    if (record.sensitivity === 'high' && options.confirmed !== true) {
      this._nextFactId -= 1;
      return {
        success: false,
        requiresConfirmation: true,
        error: 'identity_relationship_confirmation_required',
        fact: cloneFact(record)
      };
    }
    record.user_confirmed = record.user_confirmed || options.confirmed === true;
    this._facts.push(record);
    this._persist();
    this.audit.append({
      action: 'create',
      domain: record.domain,
      factId: record.id,
      sensitivity: record.sensitivity
    });
    return { success: true, fact: cloneFact(record) };
  }

  getFact(id) {
    const record = this._facts.find(fact => fact.id === id);
    return cloneFact(record || null);
  }

  findFacts(subject = null, predicate = null) {
    return this._facts
      .filter(fact =>
        (subject === null || fact.subject === subject) &&
        (predicate === null || fact.predicate === predicate)
      )
      .map(cloneFact);
  }

  listFacts(options = {}) {
    let facts = this._facts;
    if (options.domain) {
      facts = facts.filter(fact => fact.domain === options.domain);
    }
    if (options.confirmed === true) {
      facts = facts.filter(fact => fact.user_confirmed);
    }
    if (options.source) {
      facts = facts.filter(fact => fact.source === options.source);
    }
    return facts.map(cloneFact);
  }

  updateFact(id, update = {}, options = {}) {
    if (!this._initialized) {
      return { success: false, error: 'store_not_initialized' };
    }
    const index = this._facts.findIndex(fact => fact.id === id);
    if (index < 0) {
      return { success: false, error: 'fact_not_found' };
    }
    const current = this._facts[index];
    const nextObject = update.object !== undefined ? update.object : current.object;
    const nextAttributes = update.attributes !== undefined ? update.attributes : current.attributes;
    if (nextObject === current.object &&
        JSON.stringify(nextAttributes || {}) === JSON.stringify(current.attributes || {})) {
      return { success: false, alreadyCurrent: true, fact: cloneFact(current) };
    }
    if (current.sensitivity === 'high' && options.confirmed !== true) {
      return {
        success: false,
        requiresConfirmation: true,
        error: 'identity_relationship_confirmation_required',
        fact: cloneFact(current)
      };
    }
    const updated = supersedeRecord(current, {
      object: nextObject,
      attributes: nextAttributes,
      reason: update.reason || 'correction',
      at: options.at,
      confirmed: options.confirmed
    });
    this._facts[index] = updated;
    this._persist();
    this.audit.append({
      action: 'update',
      domain: updated.domain,
      factId: updated.id,
      sensitivity: updated.sensitivity
    });
    return { success: true, fact: cloneFact(updated) };
  }

  reinforceFact(id, options = {}) {
    const index = this._facts.findIndex(fact => fact.id === id);
    if (index < 0) {
      return { success: false, error: 'fact_not_found' };
    }
    const record = applyReinforcement(this._facts[index], options);
    this._facts[index] = record;
    this._persist();
    this.audit.append({
      action: 'reinforce',
      domain: record.domain,
      factId: record.id,
      sensitivity: record.sensitivity
    });
    return { success: true, fact: cloneFact(record) };
  }

  runDecay(options = {}) {
    let updated = 0;
    let expired = 0;
    const remaining = [];
    for (const fact of this._facts) {
      const decay = applyDecay(fact, options);
      if (decay.expired) {
        expired += 1;
        this.audit.append({
          action: 'expired',
          domain: fact.domain,
          factId: fact.id,
          sensitivity: fact.sensitivity
        });
        continue;
      }
      if (decay.confidence !== fact.confidence) {
        fact.confidence = decay.confidence;
        updated += 1;
      }
      remaining.push(fact);
    }
    if (updated > 0 || expired > 0) {
      this._facts = remaining;
      this._persist();
    }
    return { updated, expired };
  }

  deleteFact(id) {
    const index = this._facts.findIndex(fact => fact.id === id);
    if (index < 0) {
      return { success: false, error: 'fact_not_found' };
    }
    const fact = this._facts[index];
    this._facts.splice(index, 1);
    this._persist();
    this.audit.append({
      action: 'delete',
      domain: fact.domain,
      factId: fact.id,
      sensitivity: fact.sensitivity
    });
    return { success: true, fact: cloneFact(fact) };
  }

  wipeDomain(domain) {
    if (!domain || !isKnownDomain(domain)) {
      return { success: false, error: 'unknown_domain' };
    }
    const before = this._facts.length;
    this._facts = this._facts.filter(fact => fact.domain !== domain);
    const removed = before - this._facts.length;
    if (removed > 0) {
      this._persist();
    }
    this.audit.append({ action: 'wipe-domain', domain, factId: null });
    return { success: true, removed };
  }

  wipeAll(options = {}) {
    if (options.confirmed !== true) {
      return { success: false, requiresConfirmation: true, error: 'full_wipe_confirmation_required' };
    }
    const removed = this._facts.length;
    this._facts = [];
    this._persist();
    this.audit.append({ action: 'wipe-all', domain: 'all', factId: null });
    return { success: true, removed };
  }

  addInferredFact(input = {}) {
    if (!this._initialized) {
      return { success: false, error: 'store_not_initialized' };
    }
    if (Number.isFinite(input.confidence) && input.confidence > 0.5) {
      return { success: false, error: 'inferred facts must start at or below 0.5 confidence' };
    }
    let record;
    try {
      record = createFact({
        ...input,
        source: 'inferred',
        confidence: Number.isFinite(input.confidence) ? input.confidence : 0.5,
        userConfirmed: false,
        id: this._allocateFactId()
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
    const denied = this._deniedThirdPartyModel(record);
    if (denied) {
      return denied;
    }
    this._pending.push(record);
    this._persistPending();
    this.audit.append({
      action: 'pending-add',
      domain: record.domain,
      factId: record.id,
      sensitivity: record.sensitivity
    });
    return { success: true, fact: cloneFact(record) };
  }

  listPending() {
    return this._pending.map(cloneFact);
  }

  promotePendingFact(id, options = {}) {
    const index = this._pending.findIndex(fact => fact.id === id);
    if (index < 0) {
      return { success: false, error: 'pending_fact_not_found' };
    }
    const record = this._pending[index];
    if (record.sensitivity !== 'low' && options.confirmed !== true) {
      return {
        success: false,
        requiresConfirmation: true,
        error: 'confirmation_required_for_promotion',
        fact: cloneFact(record)
      };
    }
    this._pending.splice(index, 1);
    const promoted = {
      ...record,
      confidence: Math.max(Number(record.confidence) || 0, 0.6),
      last_reinforced: new Date().toISOString(),
      user_confirmed: record.sensitivity === 'low' || options.confirmed === true
    };
    this._facts.push(promoted);
    this._persist();
    this._persistPending();
    this.audit.append({
      action: 'pending-promote',
      domain: promoted.domain,
      factId: promoted.id,
      sensitivity: promoted.sensitivity
    });
    return { success: true, fact: cloneFact(promoted) };
  }

  rejectPendingFact(id) {
    const index = this._pending.findIndex(fact => fact.id === id);
    if (index < 0) {
      return { success: false, error: 'pending_fact_not_found' };
    }
    const record = this._pending[index];
    this._pending.splice(index, 1);
    this._persistPending();
    this.audit.append({
      action: 'pending-reject',
      domain: record.domain,
      factId: record.id,
      sensitivity: record.sensitivity
    });
    return { success: true, fact: cloneFact(record) };
  }

  getAllUserFacts() {
    const facts = {};
    this._facts
      .filter(fact => fact.user_confirmed && fact.subject === 'user')
      .forEach(fact => {
        const key = `${fact.subject}:${fact.predicate}`;
        const value = typeof fact.object === 'object' && fact.object !== null
          ? JSON.stringify(fact.object)
          : String(fact.object);
        if (!Object.prototype.hasOwnProperty.call(facts, key)) {
          facts[key] = value;
        }
      });
    return facts;
  }

  getUserName() {
    const fact = this._facts.find(record =>
      record.subject === 'user' &&
      record.predicate === 'has_name' &&
      !record.deleted
    );
    if (!fact || fact.object === undefined || fact.object === null || fact.object === '') {
      return null;
    }
    if (typeof fact.object === 'object') {
      return fact.object.value !== undefined ? String(fact.object.value) : null;
    }
    return String(fact.object);
  }

  setUserName(name, options = {}) {
    if (!this._initialized) {
      return { success: false, error: 'store_not_initialized' };
    }
    const value = String(name || '').trim();
    if (!value) {
      return { success: false, error: 'name_required' };
    }
    const existing = this._facts.find(record =>
      record.subject === 'user' &&
      record.predicate === 'has_name' &&
      !record.deleted
    );
    if (existing) {
      if (String(existing.object) === value) {
        return { success: true, unchanged: true, fact: cloneFact(existing) };
      }
      return this.updateFact(
        existing.id,
        { object: value, reason: options.reason || 'profile_sync' },
        { confirmed: true, at: options.at }
      );
    }
    return this.addFact({
      domain: 'identity',
      subject: 'user',
      predicate: 'has_name',
      object: value,
      source: options.source || 'explicit_statement',
      confidence: options.confidence,
      userConfirmed: true
    }, { confirmed: true });
  }

  stats() {
    const byDomain = {};
    this._facts.forEach(fact => {
      byDomain[fact.domain] = (byDomain[fact.domain] || 0) + 1;
    });
    return {
      initialized: this._initialized,
      factCount: this._facts.length,
      pendingCount: this._pending.length,
      byDomain,
      nextFactId: this._nextFactId
    };
  }
}

module.exports = LearningStore;
module.exports.STORE_FORMAT = STORE_FORMAT;
module.exports.SUPPORTED_SCHEMA_VERSION = SUPPORTED_SCHEMA_VERSION;