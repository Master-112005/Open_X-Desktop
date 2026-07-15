'use strict';

const FaceMemoryConfiguration = require('../configuration/FaceMemoryConfiguration');
const FaceMemoryDiagnostics = require('../diagnostics/FaceMemoryDiagnostics');
const { FaceMemoryEventBus, FACE_MEMORY_EVENTS } = require('../events/FaceMemoryEvents');
const FaceMemoryLifecycle = require('../lifecycle/FaceMemoryLifecycle');
const FaceMemoryValidator = require('../validation/FaceMemoryValidator');
const ConsentManager = require('../consent/ConsentManager');
const FacePrivacyManager = require('../privacy/FacePrivacyManager');
const FaceEmbeddingStore = require('../embeddings/FaceEmbeddingStore');
const FaceGroupingEngine = require('../grouping/FaceGroupingEngine');
const FaceMatchingEngine = require('../matching/FaceMatchingEngine');
const PersonProfileManager = require('../profiles/PersonProfileManager');
const IdentityManager = require('../identities/IdentityManager');
const FaceEnrollmentManager = require('../enrollment/FaceEnrollmentManager');
const FaceRelationshipManager = require('../relationships/FaceRelationshipManager');
const FaceTimelineManager = require('../timelines/FaceTimelineManager');
const FaceCollectionManager = require('../collections/FaceCollectionManager');

function createState() {
  return {
    consent: { status: 'unknown' },
    identities: {},
    profiles: {},
    embeddings: {},
    unknownClusters: {},
    relationships: {},
    history: []
  };
}

class FaceMemoryEngine {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof FaceMemoryConfiguration
      ? options.configuration
      : new FaceMemoryConfiguration(options.configuration || options);
    this.state = options.state || createState();
    if (this.state.consent?.status === 'enabled') this.configuration.enabled = true;
    this.events = options.events || new FaceMemoryEventBus();
    this.diagnostics = options.diagnostics || new FaceMemoryDiagnostics({ logger: options.logger || null });
    this.lifecycle = new FaceMemoryLifecycle({ events: this.events, diagnostics: this.diagnostics });
    this.validator = options.validator || new FaceMemoryValidator();
    this.consent = new ConsentManager({ state: this.state, events: this.events, diagnostics: this.diagnostics });
    this.privacy = new FacePrivacyManager({ state: this.state, configuration: this.configuration, consent: this.consent, diagnostics: this.diagnostics });
    this.embeddings = new FaceEmbeddingStore({ state: this.state, validator: this.validator });
    this.profiles = new PersonProfileManager({ state: this.state });
    this.identities = new IdentityManager({ state: this.state, profiles: this.profiles, embeddings: this.embeddings, validator: this.validator, events: this.events, diagnostics: this.diagnostics });
    this.grouping = new FaceGroupingEngine({ state: this.state, embeddings: this.embeddings, configuration: this.configuration, diagnostics: this.diagnostics, events: this.events });
    this.matching = new FaceMatchingEngine({ state: this.state, embeddings: this.embeddings, configuration: this.configuration });
    this.enrollment = new FaceEnrollmentManager({ consent: this.consent, grouping: this.grouping, identities: this.identities, privacy: this.privacy, validator: this.validator });
    this.relationships = new FaceRelationshipManager({ state: this.state });
    this.timeline = new FaceTimelineManager({ state: this.state, embeddings: this.embeddings });
    this.collections = new FaceCollectionManager({ state: this.state });
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return this;
    this.initialized = true;
    this.lifecycle.transition('ready', { enabled: this.configuration.enabled });
    this.events.emit(FACE_MEMORY_EVENTS.INITIALIZED, this.getStatus());
    return this;
  }

  enableFaceMemory(options = {}) {
    this.configuration.enabled = true;
    return this.consent.enable(options);
  }

  disableFaceMemory(reason) {
    this.configuration.enabled = false;
    return this.consent.disable(reason);
  }

  ingestUnknownFace(input) {
    if (!this.configuration.enabled) return { skipped: true, reason: 'face-memory-disabled' };
    return this.enrollment.ingestUnknownFace(input);
  }

  getEnrollmentSuggestions() {
    if (!this.configuration.enabled) return [];
    return this.enrollment.getSuggestions();
  }

  enrollCluster(input) {
    if (!this.configuration.enabled) throw new Error('Face Memory is disabled.');
    return this.enrollment.enrollCluster(input);
  }

  matchFace(vector) {
    if (!this.configuration.enabled) return { matches: [], disabled: true };
    return this.matching.match(vector);
  }

  searchFaces(query = {}) {
    const relationship = String(query.relationship || '').toLowerCase();
    const name = String(query.name || '').toLowerCase();
    const unknown = query.unknown === true;
    if (unknown) return { unknown: Object.values(this.state.unknownClusters), profiles: [] };
    const profiles = this.profiles.listProfiles().filter(profile => {
      if (name && !String(profile.name || '').toLowerCase().includes(name)) return false;
      if (relationship && String(profile.relationship || '').toLowerCase() !== relationship) return false;
      return true;
    });
    return { profiles, unknown: [] };
  }

  mergeIdentities(sourceId, targetId) {
    return this.identities.mergeIdentities(sourceId, targetId);
  }

  splitIdentity(identityId, embeddingIds, newName) {
    return this.identities.splitIdentity(identityId, embeddingIds, newName);
  }

  deleteIdentity(identityId) {
    return this.identities.deleteIdentity(identityId);
  }

  reset() {
    const result = this.privacy.deleteEverything();
    this.events.emit(FACE_MEMORY_EVENTS.RESET, result);
    return result;
  }

  exportFaceData() {
    return JSON.parse(JSON.stringify({
      consent: this.consent.getConsent(),
      identities: this.state.identities,
      profiles: this.state.profiles,
      embeddings: this.state.embeddings,
      unknownClusters: this.state.unknownClusters,
      relationships: this.state.relationships
    }));
  }

  listProfiles() { return this.profiles.listProfiles(); }
  listIdentities() { return this.identities.listIdentities(); }
  getCollections() { return this.collections.getCollections(); }
  getTimeline(identityId) { return this.timeline.getTimeline(identityId); }
  setRelationship(identityId, relationship, source) { return this.relationships.setRelationship(identityId, relationship, source); }
  reviewPermissions() { return this.consent.reviewPermissions(); }
  getPrivacyState() { return this.privacy.getPrivacyState(); }

  async shutdown() {
    this.initialized = false;
    this.lifecycle.transition('shutdown');
    this.events.emit(FACE_MEMORY_EVENTS.SHUTDOWN, this.getStatus());
    return this.getStatus();
  }

  healthCheck() {
    return {
      initialized: this.initialized,
      enabled: this.configuration.enabled,
      consent: this.consent.getConsent(),
      lifecycle: this.lifecycle.getState(),
      identities: Object.keys(this.state.identities).length,
      profiles: Object.keys(this.state.profiles).length,
      unknownClusters: Object.keys(this.state.unknownClusters).length,
      embeddings: Object.keys(this.state.embeddings).length,
      diagnostics: this.diagnostics.summary()
    };
  }

  getStatus() {
    return {
      initialized: this.initialized,
      enabled: this.configuration.enabled,
      consent: this.consent.getConsent(),
      lifecycle: this.lifecycle.getState()
    };
  }
}

FaceMemoryEngine.createState = createState;

module.exports = FaceMemoryEngine;
