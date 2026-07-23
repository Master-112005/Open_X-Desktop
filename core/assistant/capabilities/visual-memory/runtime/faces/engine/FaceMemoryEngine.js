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
const {
  clamp01,
  cosineSimilarity,
  faceQualityScore,
  weightedMeanVector
} = require('../utils/face-utils');

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
    const quality = Number.isFinite(Number(input?.quality))
      ? Math.max(0, Math.min(1, Number(input.quality)))
      : faceQualityScore({
        confidence: input?.confidence,
        faceBox: input?.faceBox,
        imageWidth: input?.imageWidth,
        imageHeight: input?.imageHeight,
        vector: input?.vector
      });
    const enrichedInput = { ...(input || {}), quality };
    const match = this.matching.match(enrichedInput.vector || [], enrichedInput);
    const best = match?.best || null;
    const autoAssignMargin = Number(this.configuration.thresholds.autoAssignMargin ?? 0.018);
    const goodEnoughQuality = quality >= Number(this.configuration.quality?.minAutoAssignQuality ?? 0.62);
    const exactMatch = best?.confidence >= this.configuration.thresholds.autoAssignExact;
    const strongNamedMatch = best?.confidence >= this.configuration.thresholds.autoAssignStrong;
    const provenIdentityMatch = best?.confidence >= this.configuration.thresholds.autoAssignKnown
      && (best?.evidenceCount || 0) >= this.configuration.enrollment.autoAssignMinEvidence;
    const highConfidence = goodEnoughQuality && (exactMatch || strongNamedMatch || provenIdentityMatch);
    const enoughSeparation = !best?.ambiguous && (best?.margin ?? 1) >= autoAssignMargin;
    if (best?.identityId && highConfidence && enoughSeparation) {
      const assigned = this.identities.addEmbeddingToIdentity(match.best.identityId, enrichedInput, {
        action: exactMatch ? 'auto-exact-match' : 'auto-named-match',
        by: 'face-memory',
        duplicateThreshold: this.configuration.thresholds.duplicate,
        duplicateCrossPhotoThreshold: this.configuration.thresholds.duplicateCrossPhoto,
        duplicateBoxIoU: this.configuration.thresholds.duplicateBoxIoU,
        source: enrichedInput.source || 'ai-vision'
      });
      this.diagnostics?.record?.('known-face-auto-assigned', {
        identityId: match.best.identityId,
        name: match.best.name,
        confidence: match.best.confidence,
        margin: match.best.margin,
        evidenceCount: match.best.evidenceCount,
        exactMatch,
        duplicate: assigned.duplicate === true,
        quality,
        photoId: enrichedInput.photoId || null
      });
      return {
        assigned: true,
        autoAssigned: true,
        duplicate: assigned.duplicate === true,
        match: match.best,
        identity: assigned.identity,
        profile: assigned.profile,
        embedding: assigned.embedding
      };
    }
    if (best?.identityId && highConfidence && !enoughSeparation) {
      this.diagnostics?.record?.('known-face-auto-assign-deferred', {
        identityId: best.identityId,
        name: best.name,
        confidence: best.confidence,
        margin: best.margin,
        evidenceCount: best.evidenceCount,
        secondBestIdentityId: best.secondBestIdentityId || null,
        reason: 'ambiguous-face-match'
      });
    }
    return this.enrollment.ingestUnknownFace(enrichedInput);
  }

  getEnrollmentSuggestions() {
    if (!this.configuration.enabled) return [];
    return this.enrollment.getSuggestions();
  }

  reconcileUnknownClustersWithIdentities(options = {}) {
    const summary = {
      checkedClusters: 0,
      assignedClusters: 0,
      deferredClusters: 0,
      skippedClusters: 0,
      assignedEmbeddingCount: 0,
      assignments: []
    };
    if (!this.configuration.enabled || !this.configuration.privacy.matchingEnabled) {
      return { ...summary, skipped: true, reason: 'matching-disabled' };
    }

    const threshold = Number(options.clusterAutoAssign ?? this.configuration.thresholds.clusterAutoAssign ?? 0.92);
    const requiredMargin = Number(options.clusterAutoAssignMargin ?? this.configuration.thresholds.clusterAutoAssignMargin ?? 0.024);
    const minEvidence = Math.max(2, Number(options.clusterAutoAssignMinEvidence ?? this.configuration.enrollment.clusterAutoAssignMinEvidence ?? 2));
    const minQuality = Number(options.minAutoAssignQuality ?? this.configuration.quality?.minAutoAssignQuality ?? 0.62);
    const clusters = Object.values(this.state.unknownClusters || {})
      .filter(cluster => cluster.status === 'unknown' && !cluster.ignoredAt && !cluster.neverAskAgain);

    for (const cluster of clusters) {
      summary.checkedClusters += 1;
      const decision = this._evaluateUnknownClusterIdentityMatch(cluster, {
        threshold,
        requiredMargin,
        minEvidence,
        minQuality
      });
      if (decision.action === 'assign') {
        const assigned = this.enrollment.addClusterToIdentity({
          clusterId: cluster.id,
          identityId: decision.identityId
        });
        summary.assignedClusters += 1;
        summary.assignedEmbeddingCount += decision.embeddingCount;
        summary.assignments.push({
          clusterId: cluster.id,
          identityId: decision.identityId,
          name: decision.name,
          confidence: decision.confidence,
          margin: decision.margin,
          supportCount: decision.supportCount,
          embeddingCount: decision.embeddingCount
        });
        this.diagnostics?.record?.('unknown-cluster-auto-assigned-to-identity', {
          clusterId: cluster.id,
          identityId: decision.identityId,
          name: decision.name,
          confidence: decision.confidence,
          margin: decision.margin,
          supportCount: decision.supportCount,
          embeddingCount: decision.embeddingCount,
          photoCount: cluster.photoIds?.length || 0,
          duplicate: assigned?.identity?.id === decision.identityId
        });
      } else if (decision.action === 'defer') {
        summary.deferredClusters += 1;
        this.diagnostics?.record?.('unknown-cluster-identity-match-deferred', {
          clusterId: cluster.id,
          reason: decision.reason,
          identityId: decision.identityId || null,
          confidence: decision.confidence || 0,
          margin: decision.margin || 0,
          supportCount: decision.supportCount || 0,
          embeddingCount: decision.embeddingCount || 0
        });
      } else {
        summary.skippedClusters += 1;
      }
    }

    return summary;
  }

  enrollCluster(input) {
    if (!this.configuration.enabled) throw new Error('Face Memory is disabled.');
    return this.enrollment.enrollCluster(input);
  }

  addClusterToIdentity(input) {
    if (!this.configuration.enabled) throw new Error('Face Memory is disabled.');
    return this.enrollment.addClusterToIdentity(input);
  }

  deleteCluster(clusterId) {
    if (!this.configuration.enabled) throw new Error('Face Memory is disabled.');
    return this.enrollment.deleteCluster(clusterId);
  }

  matchFace(vector) {
    if (!this.configuration.enabled) return { matches: [], disabled: true };
    return this.matching.match(vector);
  }

  identifyFace(input = {}, options = {}) {
    if (!this.configuration.enabled) {
      return { decision: 'disabled', disabled: true, confirmationRequired: false, matches: [] };
    }
    const faceInput = Array.isArray(input) ? { vector: input } : { ...input };
    const vector = faceInput.vector;
    if (!Array.isArray(vector) || vector.length === 0 || !vector.every(Number.isFinite)) {
      return { decision: 'invalid', reason: 'face-vector-required', confirmationRequired: false, matches: [] };
    }
    const quality = Number.isFinite(Number(faceInput.quality))
      ? clamp01(faceInput.quality)
      : faceQualityScore({
        confidence: faceInput.confidence,
        faceBox: faceInput.faceBox,
        imageWidth: faceInput.imageWidth,
        imageHeight: faceInput.imageHeight,
        vector
      });
    const match = this.matching.match(vector, { ...faceInput, quality });
    const best = match.best || null;
    const reviewCandidates = match.matches.slice(0, Math.max(1, Number(options.maxCandidates || 3)));
    if (best?.identityId &&
      best.decision === 'match' &&
      best.confidence >= Number(options.matchThreshold ?? this.configuration.thresholds.matching) &&
      quality >= Number(options.minQuality ?? this.configuration.quality.minAutoAssignQuality)) {
      return {
        decision: 'known',
        status: 'match',
        identityId: best.identityId,
        profileId: best.profileId,
        name: best.name,
        relationship: best.relationship,
        confidence: best.confidence,
        margin: best.margin,
        quality,
        confirmationRequired: false,
        matches: reviewCandidates
      };
    }
    if (best?.identityId && best.confidence >= this.configuration.thresholds.confidence) {
      return {
        decision: 'review',
        status: 'ambiguous-known-face',
        identityId: best.identityId,
        profileId: best.profileId,
        name: best.name,
        relationship: best.relationship,
        confidence: best.confidence,
        margin: best.margin,
        quality,
        confirmationRequired: true,
        matches: reviewCandidates,
        prompt: best.name
          ? `This looks similar to ${best.name}. Please confirm before OpenX saves it to that person.`
          : 'This looks similar to a saved person. Please confirm before OpenX saves it.'
      };
    }
    const unknown = this._bestUnknownClusterForVector(vector, { quality });
    if (unknown?.cluster && unknown.similarity >= Number(options.unknownThreshold ?? this.configuration.thresholds.grouping)) {
      return {
        decision: 'existing-unknown',
        status: 'same-unnamed-person',
        clusterId: unknown.cluster.id,
        confidence: Number(unknown.similarity.toFixed(4)),
        quality,
        confirmationRequired: true,
        prompt: 'This appears to match an unnamed person already found in the gallery.'
      };
    }
    return {
      decision: 'new-face',
      status: 'new-person-review',
      confidence: 0,
      quality,
      confirmationRequired: true,
      matches: reviewCandidates,
      prompt: 'This looks like a new person. Name it only if you want OpenX to remember them.'
    };
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

  updateIdentity(identityId, updates = {}, by = 'user-edit') {
    return this.identities.updateIdentityDetails(identityId, updates, by);
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
      relationships: this.state.relationships,
      configuration: this.configuration?.toJSON?.() || null
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

  _evaluateUnknownClusterIdentityMatch(cluster = {}, options = {}) {
    const embeddings = this.embeddings.listForCluster(cluster.id)
      .filter(embedding => embedding && Array.isArray(embedding.vector) && embedding.vector.length > 0);
    const embeddingCount = embeddings.length;
    if (embeddingCount < options.minEvidence) {
      return { action: 'skip', reason: 'insufficient-cluster-evidence', embeddingCount };
    }

    const topQuality = embeddings
      .map(embedding => clamp01(embedding.quality ?? embedding.confidence ?? 0))
      .sort((left, right) => right - left)
      .slice(0, Math.min(5, embeddings.length));
    const clusterQuality = topQuality.reduce((sum, value) => sum + value, 0) / Math.max(1, topQuality.length);
    if (clusterQuality < options.minQuality) {
      return { action: 'defer', reason: 'low-cluster-quality', embeddingCount, quality: Number(clusterQuality.toFixed(4)) };
    }

    const centroid = weightedMeanVector(embeddings.map(embedding => ({
      vector: embedding.vector,
      weight: Math.max(0.05, clamp01(embedding.quality ?? embedding.confidence ?? 0.75))
    })));
    if (!centroid.length) {
      return { action: 'skip', reason: 'cluster-centroid-unavailable', embeddingCount };
    }

    const centroidMatch = this.matching.match(centroid, { quality: clusterQuality }).best || null;
    if (!centroidMatch?.identityId) {
      return { action: 'skip', reason: 'no-known-identity-match', embeddingCount };
    }

    const votes = new Map();
    for (const embedding of embeddings) {
      const match = this.matching.match(embedding.vector, {
        quality: embedding.quality,
        confidence: embedding.confidence,
        faceBox: embedding.faceBox,
        imageWidth: embedding.imageWidth,
        imageHeight: embedding.imageHeight
      }).best;
      if (!match?.identityId) continue;
      const current = votes.get(match.identityId) || {
        identityId: match.identityId,
        name: match.name,
        count: 0,
        confidenceSum: 0,
        marginSum: 0,
        matchingCount: 0
      };
      current.count += 1;
      current.confidenceSum += Number(match.confidence) || 0;
      current.marginSum += Number(match.margin) || 0;
      if (match.decision === 'match' || match.ambiguous === false) current.matchingCount += 1;
      votes.set(match.identityId, current);
    }

    const orderedVotes = Array.from(votes.values())
      .sort((left, right) => right.count - left.count ||
        (right.confidenceSum / Math.max(1, right.count)) - (left.confidenceSum / Math.max(1, left.count)));
    const strongestVote = orderedVotes[0] || null;
    const secondVote = orderedVotes[1] || null;
    if (!strongestVote || strongestVote.identityId !== centroidMatch.identityId) {
      return {
        action: 'defer',
        reason: 'cluster-centroid-and-samples-disagree',
        identityId: centroidMatch.identityId,
        confidence: centroidMatch.confidence,
        margin: centroidMatch.margin,
        embeddingCount
      };
    }

    const supportRatio = strongestVote.count / Math.max(1, embeddingCount);
    const voteMargin = strongestVote.count - (secondVote?.count || 0);
    const averageSampleConfidence = strongestVote.confidenceSum / Math.max(1, strongestVote.count);
    const averageSampleMargin = strongestVote.marginSum / Math.max(1, strongestVote.count);
    const enoughSupport = strongestVote.count >= options.minEvidence &&
      supportRatio >= 0.66 &&
      voteMargin >= 1 &&
      strongestVote.matchingCount >= Math.min(strongestVote.count, options.minEvidence);
    const enoughConfidence = centroidMatch.confidence >= options.threshold &&
      averageSampleConfidence >= Math.max(this.configuration.thresholds.confidence, options.threshold - 0.04);
    const enoughSeparation = !centroidMatch.ambiguous &&
      (centroidMatch.margin ?? 1) >= options.requiredMargin &&
      averageSampleMargin >= Math.max(0.012, options.requiredMargin * 0.5);

    if (enoughSupport && enoughConfidence && enoughSeparation) {
      return {
        action: 'assign',
        identityId: centroidMatch.identityId,
        name: centroidMatch.name,
        confidence: Number(Math.min(1, ((centroidMatch.confidence * 0.62) + (averageSampleConfidence * 0.38))).toFixed(4)),
        margin: Number(Math.min(1, Math.min(centroidMatch.margin ?? 1, averageSampleMargin || 1)).toFixed(4)),
        supportCount: strongestVote.count,
        embeddingCount,
        quality: Number(clusterQuality.toFixed(4))
      };
    }

    return {
      action: 'defer',
      reason: 'cluster-match-not-strong-enough',
      identityId: centroidMatch.identityId,
      name: centroidMatch.name,
      confidence: centroidMatch.confidence,
      margin: centroidMatch.margin,
      supportCount: strongestVote.count,
      embeddingCount,
      supportRatio: Number(supportRatio.toFixed(4)),
      averageSampleConfidence: Number(averageSampleConfidence.toFixed(4)),
      averageSampleMargin: Number(averageSampleMargin.toFixed(4))
    };
  }

  _bestUnknownClusterForVector(vector = [], options = {}) {
    let best = null;
    for (const cluster of Object.values(this.state.unknownClusters || {})) {
      if (cluster.status !== 'unknown' || cluster.ignoredAt || cluster.neverAskAgain) continue;
      const embeddings = this.embeddings.listForCluster(cluster.id)
        .filter(embedding => embedding && Array.isArray(embedding.vector));
      if (embeddings.length === 0) continue;
      const centroid = weightedMeanVector(embeddings.map(embedding => ({
        vector: embedding.vector,
        weight: Math.max(0.05, clamp01(embedding.quality ?? embedding.confidence ?? 0.75))
      })));
      const similarity = centroid.length ? cosineSimilarity(vector, centroid) : 0;
      const topQualities = embeddings
        .map(embedding => clamp01(embedding.quality ?? embedding.confidence ?? 0.75))
        .sort((left, right) => right - left)
        .slice(0, Math.min(5, embeddings.length));
      const quality = topQualities.length
        ? topQualities.reduce((sum, value) => sum + value, 0) / topQualities.length
        : 0.75;
      const weightedSimilarity = Math.min(1, similarity * (0.94 + (Math.min(clamp01(options.quality ?? 0.75), quality || 0.75) * 0.06)));
      if (!best || weightedSimilarity > best.similarity) {
        best = {
          cluster,
          similarity: weightedSimilarity,
          embeddingCount: embeddings.length
        };
      }
    }
    return best;
  }
}

FaceMemoryEngine.createState = createState;

module.exports = FaceMemoryEngine;
