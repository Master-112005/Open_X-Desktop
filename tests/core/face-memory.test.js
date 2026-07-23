'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  FaceMemoryEngine,
  FaceMemoryContract,
  FACE_MEMORY_OUT_OF_SCOPE,
  VisualMemoryEngine
} = require('../../core/assistant/capabilities/visual-memory');
const {
  faceEmbeddingSimilarity,
  faceQualityScore,
  faceSignalQuality
} = require('../../core/assistant/capabilities/visual-memory/runtime/faces/utils/face-utils');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openx-face-memory-'));
}

async function enabledEngine(options = {}) {
  const engine = new FaceMemoryEngine({
    configuration: {
      enrollment: { minUnknownPhotos: 2 },
      ...(options.configuration || {})
    }
  });
  await engine.initialize();
  engine.enableFaceMemory({ acceptedBy: 'test-user' });
  return engine;
}

function addTwoUnknownFaces(engine) {
  const first = engine.ingestUnknownFace({ vector: [1, 0], photoId: 'p1', faceId: 'f1', confidence: 0.94 });
  const second = engine.ingestUnknownFace({ vector: [0.99, 0.01], photoId: 'p2', faceId: 'f2', confidence: 0.92 });
  return { first, second };
}

describe('Face Memory System', () => {
  it('is disabled by default and refuses face ingestion without explicit consent', async () => {
    const engine = new FaceMemoryEngine();
    await engine.initialize();

    const result = engine.ingestUnknownFace({ vector: [1, 0], photoId: 'p1' });

    assert.strictEqual(engine.getStatus().enabled, false);
    assert.strictEqual(result.skipped, true);
    assert.strictEqual(result.reason, 'face-memory-disabled');
    assert.strictEqual(FaceMemoryContract.disabledByDefault, true);
    assert.strictEqual(FACE_MEMORY_OUT_OF_SCOPE.includes('automatic-naming'), true);
    assert.strictEqual(FACE_MEMORY_OUT_OF_SCOPE.includes('face-embedding-generation'), true);
  });

  it('groups unknown faces only after consent and creates suggestions from repeated evidence', async () => {
    const engine = await enabledEngine();
    addTwoUnknownFaces(engine);

    const suggestions = engine.getEnrollmentSuggestions();

    assert.strictEqual(suggestions.length, 1);
    assert.strictEqual(suggestions[0].photoCount, 2);
    assert(suggestions[0].options.includes('Name Person'));
  });

  it('collapses repeated local face descriptors into one unnamed person', async () => {
    const engine = await enabledEngine();
    const firstDescriptor = [0.2, 0.1, 0.3, 0.4, 0.12, 0.08, 0.22, 0.18, 0.03, 0.02, 0.04, 0.01];
    const secondDescriptor = [0.205, 0.095, 0.31, 0.39, 0.13, 0.075, 0.21, 0.185, 0.035, 0.019, 0.041, 0.012];
    const differentDescriptor = [0.9, 0.75, 0.2, 0.05, 0.65, 0.6, 0.02, 0.8, 0.44, 0.3, 0.01, 0.7];

    const first = engine.ingestUnknownFace({
      vector: firstDescriptor,
      photoId: 'same-person-1',
      faceId: 'same-person-face-1',
      confidence: 0.96,
      quality: 0.88,
      metadata: { vectorType: 'local-face-region-v3' }
    });
    const second = engine.ingestUnknownFace({
      vector: secondDescriptor,
      photoId: 'same-person-2',
      faceId: 'same-person-face-2',
      confidence: 0.95,
      quality: 0.87,
      metadata: { vectorType: 'local-face-region-v3' }
    });
    const different = engine.ingestUnknownFace({
      vector: differentDescriptor,
      photoId: 'different-person',
      faceId: 'different-person-face',
      confidence: 0.95,
      quality: 0.87,
      metadata: { vectorType: 'local-face-region-v3' }
    });

    const unknownClusters = Object.values(engine.state.unknownClusters)
      .filter(cluster => cluster.status === 'unknown');

    assert(faceEmbeddingSimilarity(firstDescriptor, secondDescriptor) >= 0.94);
    assert(faceEmbeddingSimilarity(firstDescriptor, differentDescriptor) < 0.75);
    assert.strictEqual(first.cluster.id, second.cluster.id);
    assert.notStrictEqual(first.cluster.id, different.cluster.id);
    assert.strictEqual(unknownClusters.length, 2);
    assert.strictEqual(first.cluster.photoIds.length, 2);
  });

  it('uses runtime face quality signals to separate clear and weak face crops', async () => {
    const clearSignals = {
      sharpness: 0.09,
      contrast: 0.12,
      textureEnergy: 0.08,
      brightness: 0.52,
      brightnessSpread: 0.16,
      symmetry: 0.82
    };
    const weakSignals = {
      sharpness: 0.002,
      contrast: 0.004,
      textureEnergy: 0.003,
      brightness: 0.99,
      brightnessSpread: 0.006,
      symmetry: 0.08
    };
    const baseInput = {
      confidence: 0.94,
      faceBox: { x: 40, y: 40, width: 120, height: 132, imageWidth: 900, imageHeight: 700 },
      imageWidth: 900,
      imageHeight: 700,
      vector: [0.2, 0.1, 0.3, 0.4, 0.12, 0.08, 0.22, 0.18]
    };

    assert(faceSignalQuality(clearSignals) > faceSignalQuality(weakSignals));
    assert(faceQualityScore({ ...baseInput, qualitySignals: clearSignals }) >
      faceQualityScore({ ...baseInput, qualitySignals: weakSignals }));
  });

  it('enrolls a user-confirmed identity and matches future embeddings', async () => {
    const engine = await enabledEngine();
    addTwoUnknownFaces(engine);
    const [suggestion] = engine.getEnrollmentSuggestions();

    const enrolled = engine.enrollCluster({
      clusterId: suggestion.clusterId,
      name: 'Rahul',
      relationship: 'friend',
      notes: 'Confirmed from gallery review'
    });
    const match = engine.matchFace([0.98, 0.02]);
    const search = engine.searchFaces({ relationship: 'friend' });
    const timeline = engine.getTimeline(enrolled.identity.id);

    assert.strictEqual(enrolled.identity.name, 'Rahul');
    assert.strictEqual(match.best.name, 'Rahul');
    assert(match.best.confidence >= 0.9);
    assert.strictEqual(search.profiles[0].name, 'Rahul');
    assert.strictEqual(timeline.identityId, enrolled.identity.id);
    assert.strictEqual(timeline.photoCount, 2);
  });

  it('identifies strong saved-person face probes without asking for manual naming again', async () => {
    const engine = await enabledEngine();
    addTwoUnknownFaces(engine);
    const [suggestion] = engine.getEnrollmentSuggestions();
    const enrolled = engine.enrollCluster({
      clusterId: suggestion.clusterId,
      name: 'Rahul',
      relationship: 'friend'
    });

    const identification = engine.identifyFace({
      vector: [0.98, 0.02],
      photoId: 'future-photo',
      faceId: 'future-face',
      confidence: 0.97,
      quality: 0.9
    });

    assert.strictEqual(identification.decision, 'known');
    assert.strictEqual(identification.confirmationRequired, false);
    assert.strictEqual(identification.identityId, enrolled.identity.id);
    assert.strictEqual(identification.name, 'Rahul');
    assert(identification.confidence >= 0.92);
  });

  it('requires confirmation when a face is close to more than one saved person', async () => {
    const engine = await enabledEngine();
    const rahulEmbedding = engine.embeddings.addEmbedding({ vector: [1, 0], photoId: 'rahul-1', confidence: 0.99, quality: 0.9 });
    const rohitEmbedding = engine.embeddings.addEmbedding({ vector: [0.9999, 0.014], photoId: 'rohit-1', confidence: 0.99, quality: 0.9 });
    const rahul = engine.identities.createIdentity({ name: 'Rahul', embeddings: [rahulEmbedding] }).identity;
    const rohit = engine.identities.createIdentity({ name: 'Rohit', embeddings: [rohitEmbedding] }).identity;

    const identification = engine.identifyFace({
      vector: [1, 0],
      photoId: 'ambiguous-photo',
      faceId: 'ambiguous-face',
      confidence: 0.99,
      quality: 0.9
    });

    assert.strictEqual(identification.decision, 'review');
    assert.strictEqual(identification.confirmationRequired, true);
    assert([rahul.id, rohit.id].includes(identification.identityId));
    assert(identification.matches.length >= 2);
  });

  it('routes repeated unnamed probes to the existing unknown person instead of creating a new person', async () => {
    const engine = await enabledEngine();
    engine.ingestUnknownFace({ vector: [0, 1], photoId: 'unknown-1', faceId: 'unknown-face-1', confidence: 0.96, quality: 0.88 });
    engine.ingestUnknownFace({ vector: [0.01, 0.99], photoId: 'unknown-2', faceId: 'unknown-face-2', confidence: 0.95, quality: 0.86 });

    const knownUnknown = engine.identifyFace({
      vector: [0.02, 0.98],
      photoId: 'unknown-3',
      faceId: 'unknown-face-3',
      confidence: 0.95,
      quality: 0.86
    });
    const newFace = engine.identifyFace({
      vector: [-1, 0],
      photoId: 'different-person',
      faceId: 'different-face',
      confidence: 0.95,
      quality: 0.86
    });

    assert.strictEqual(knownUnknown.decision, 'existing-unknown');
    assert.strictEqual(knownUnknown.confirmationRequired, true);
    assert(knownUnknown.clusterId);
    assert.strictEqual(newFace.decision, 'new-face');
    assert.strictEqual(newFace.confirmationRequired, true);
  });

  it('updates saved person name and relationship for Gallery people cards', async () => {
    const engine = await enabledEngine();
    addTwoUnknownFaces(engine);
    const [suggestion] = engine.getEnrollmentSuggestions();
    const enrolled = engine.enrollCluster({
      clusterId: suggestion.clusterId,
      name: 'Rahul',
      relationship: 'friend'
    });

    const updated = engine.updateIdentity(enrolled.identity.id, {
      name: 'Daddy',
      relationship: 'father'
    }, 'test-edit');

    assert.strictEqual(updated.identity.name, 'Daddy');
    assert.strictEqual(updated.identity.relationship, 'father');
    assert.strictEqual(updated.profile.name, 'Daddy');
    assert.strictEqual(updated.profile.relationship, 'father');
    assert.strictEqual(engine.searchFaces({ relationship: 'father' }).profiles[0].name, 'Daddy');
  });

  it('supports explicit identity merge, split, delete, and privacy reset', async () => {
    const engine = await enabledEngine();
    addTwoUnknownFaces(engine);
    const firstIdentity = engine.enrollCluster({
      clusterId: engine.getEnrollmentSuggestions()[0].clusterId,
      name: 'Rahul'
    }).identity;

    engine.ingestUnknownFace({ vector: [0, 1], photoId: 'p3', faceId: 'f3', confidence: 0.9 });
    engine.ingestUnknownFace({ vector: [0.01, 0.99], photoId: 'p4', faceId: 'f4', confidence: 0.88 });
    const secondIdentity = engine.enrollCluster({
      clusterId: engine.getEnrollmentSuggestions().find(item => item.clusterId !== firstIdentity.clusterIds[0]).clusterId,
      name: 'Sita'
    }).identity;

    const merged = engine.mergeIdentities(secondIdentity.id, firstIdentity.id);
    const movedEmbedding = merged.embeddingIds[0];
    const split = engine.splitIdentity(firstIdentity.id, [movedEmbedding], 'Rahul duplicate');
    const deleted = engine.deleteIdentity(split.identity.id);

    assert.strictEqual(engine.listIdentities().length, 1);
    assert.strictEqual(deleted, true);
    const reset = engine.reset();
    assert.strictEqual(reset.deleted, true);
    assert.strictEqual(engine.getStatus().consent.enabled, false);
    assert.strictEqual(engine.listIdentities().length, 0);
  });

  it('adds an unnamed duplicate cluster to an existing identity and removes unwanted clusters', async () => {
    const engine = await enabledEngine();
    addTwoUnknownFaces(engine);
    const [suggestion] = engine.getEnrollmentSuggestions();
    const enrolled = engine.enrollCluster({ clusterId: suggestion.clusterId, name: 'Rahul' }).identity;

    engine.ingestUnknownFace({ vector: [0.55, 0.45], photoId: 'p5', faceId: 'f5', confidence: 0.91 });
    engine.ingestUnknownFace({ vector: [0.54, 0.46], photoId: 'p6', faceId: 'f6', confidence: 0.9 });
    const duplicate = engine.getEnrollmentSuggestions().find(item => item.clusterId !== suggestion.clusterId);

    const assigned = engine.addClusterToIdentity({ clusterId: duplicate.clusterId, identityId: enrolled.id });
    const match = engine.matchFace([0.54, 0.46]);
    engine.ingestUnknownFace({ vector: [0, 1], photoId: 'bad', faceId: 'bad-face', confidence: 0.9 });
    const removable = Object.values(engine.state.unknownClusters).find(cluster => cluster.status === 'unknown');
    const removed = engine.deleteCluster(removable.id);

    assert.strictEqual(assigned.identity.id, enrolled.id);
    assert(assigned.identity.clusterIds.includes(duplicate.clusterId));
    assert.strictEqual(engine.state.unknownClusters[duplicate.clusterId].status, 'enrolled');
    assert.strictEqual(match.best.name, 'Rahul');
    assert.strictEqual(removed, true);
    assert.strictEqual(engine.state.unknownClusters[removable.id], undefined);
  });

  it('remembers rejected unnamed clusters and suppresses the same face in future scans', async () => {
    const engine = await enabledEngine();
    const faceBox = { x: 28, y: 34, width: 86, height: 92, imageWidth: 300, imageHeight: 300 };
    const initial = engine.ingestUnknownFace({
      vector: [0.2, 0.1, 0.3, 0.4, 0.12, 0.08, 0.22, 0.18, 0.03, 0.02, 0.04, 0.01],
      photoId: 'rejected-photo',
      faceId: 'rejected-face',
      faceBox,
      confidence: 0.96,
      quality: 0.88,
      metadata: { vectorType: 'local-face-region-v4' }
    });

    const removed = engine.deleteCluster(initial.cluster.id);
    const rejected = engine.isRejectedFace({
      vector: [0.201, 0.101, 0.299, 0.401, 0.121, 0.079, 0.221, 0.179, 0.031, 0.021, 0.041, 0.011],
      photoId: 'future-rescan-photo',
      faceId: 'future-rescan-face',
      faceBox,
      confidence: 0.95,
      quality: 0.87,
      metadata: { vectorType: 'local-face-region-v4' }
    }, { rejectedFaceSimilarity: 0.9 });
    const rescan = engine.ingestUnknownFace({
      vector: [0.201, 0.101, 0.299, 0.401, 0.121, 0.079, 0.221, 0.179, 0.031, 0.021, 0.041, 0.011],
      photoId: 'future-rescan-photo',
      faceId: 'future-rescan-face',
      faceBox,
      confidence: 0.95,
      quality: 0.87,
      metadata: { vectorType: 'local-face-region-v4' }
    });

    assert.strictEqual(removed, true);
    assert.strictEqual(rejected.rejected, true);
    assert.strictEqual(rejected.reason, 'previously-rejected-face-signature');
    assert.strictEqual(rescan.skipped, true);
    assert.strictEqual(rescan.reason, 'previously-rejected-face');
    assert(Object.keys(engine.state.rejectedFaces).length >= 2);
    assert.strictEqual(Object.values(engine.state.unknownClusters).filter(cluster => cluster.status === 'unknown').length, 0);
  });

  it('auto-attaches exact named-face matches and suppresses same-photo duplicate embeddings', async () => {
    const engine = await enabledEngine();
    addTwoUnknownFaces(engine);
    const [suggestion] = engine.getEnrollmentSuggestions();
    const enrolled = engine.enrollCluster({ clusterId: suggestion.clusterId, name: 'Rahul' }).identity;
    const before = engine.listIdentities()[0].embeddingIds.length;

    const first = engine.ingestUnknownFace({
      vector: [1, 0],
      photoId: 'p1',
      faceId: 'f1',
      faceBox: { x: 10, y: 10, width: 80, height: 80, imageWidth: 200, imageHeight: 200 },
      confidence: 0.98
    });
    const second = engine.ingestUnknownFace({
      vector: [1, 0],
      photoId: 'p1',
      faceId: 'f1',
      faceBox: { x: 10, y: 10, width: 80, height: 80, imageWidth: 200, imageHeight: 200 },
      confidence: 0.99
    });

    assert.strictEqual(first.autoAssigned, true);
    assert.strictEqual(first.duplicate, true);
    assert.strictEqual(second.autoAssigned, true);
    assert.strictEqual(second.duplicate, true);
    assert.strictEqual(engine.listIdentities()[0].embeddingIds.length, before);
    assert.strictEqual(Object.values(engine.state.unknownClusters).filter(cluster => cluster.status === 'unknown').length, 0);
    assert.strictEqual(enrolled.name, 'Rahul');
  });

  it('auto-attaches strong saved-person matches during gallery rescans', async () => {
    const engine = await enabledEngine();
    addTwoUnknownFaces(engine);
    const [suggestion] = engine.getEnrollmentSuggestions();
    const enrolled = engine.enrollCluster({ clusterId: suggestion.clusterId, name: 'Rahul' }).identity;
    const before = engine.listIdentities()[0].embeddingIds.length;

    const result = engine.ingestUnknownFace({
      vector: [0.97, 0.24],
      photoId: 'rescan-new-photo',
      faceId: 'rescan-face',
      confidence: 0.97
    });

    assert.strictEqual(result.autoAssigned, true);
    assert.strictEqual(result.duplicate, false);
    assert.strictEqual(result.match.identityId, enrolled.id);
    assert.strictEqual(engine.listIdentities()[0].embeddingIds.length, before + 1);
    assert.strictEqual(Object.values(engine.state.unknownClusters).filter(cluster => cluster.status === 'unknown').length, 0);
  });

  it('reconciles duplicate unnamed clusters to saved identities using repeated scan evidence', async () => {
    const engine = await enabledEngine({
      configuration: {
        thresholds: {
          autoAssignExact: 1.01,
          autoAssignStrong: 1.01,
          autoAssignKnown: 1.01,
          clusterAutoAssign: 0.9,
          clusterAutoAssignMargin: 0.01
        },
        enrollment: {
          minUnknownPhotos: 2,
          clusterAutoAssignMinEvidence: 2
        }
      }
    });
    addTwoUnknownFaces(engine);
    const [suggestion] = engine.getEnrollmentSuggestions();
    const enrolled = engine.enrollCluster({ clusterId: suggestion.clusterId, name: 'Rahul' }).identity;

    const firstDuplicate = engine.ingestUnknownFace({
      vector: [0.955, 0.296],
      photoId: 'later-rahul-1',
      faceId: 'later-rahul-face-1',
      confidence: 0.97,
      quality: 0.86
    });
    const secondDuplicate = engine.ingestUnknownFace({
      vector: [0.952, 0.305],
      photoId: 'later-rahul-2',
      faceId: 'later-rahul-face-2',
      confidence: 0.96,
      quality: 0.85
    });

    assert.strictEqual(firstDuplicate.autoAssigned, undefined);
    assert.strictEqual(secondDuplicate.autoAssigned, undefined);
    assert.strictEqual(Object.values(engine.state.unknownClusters).filter(cluster => cluster.status === 'unknown').length, 1);

    const reconciliation = engine.reconcileUnknownClustersWithIdentities();
    const unknownClusters = Object.values(engine.state.unknownClusters).filter(cluster => cluster.status === 'unknown');
    const enrolledClusters = Object.values(engine.state.unknownClusters).filter(cluster => cluster.status === 'enrolled');

    assert.strictEqual(reconciliation.assignedClusters, 1);
    assert.strictEqual(reconciliation.assignedEmbeddingCount, 2);
    assert.strictEqual(reconciliation.assignments[0].identityId, enrolled.id);
    assert.strictEqual(unknownClusters.length, 0);
    assert.strictEqual(enrolledClusters.length, 2);
    assert.strictEqual(engine.state.identities[enrolled.id].embeddingIds.length, 4);
    assert.strictEqual(engine.matchFace([0.953, 0.301]).best.name, 'Rahul');
  });

  it('defers duplicate-cluster reconciliation when samples disagree with the centroid match', async () => {
    const engine = await enabledEngine({
      configuration: {
        thresholds: {
          autoAssignExact: 1.01,
          autoAssignStrong: 1.01,
          autoAssignKnown: 1.01,
          clusterAutoAssign: 0.9,
          clusterAutoAssignMargin: 0.01
        },
        enrollment: {
          minUnknownPhotos: 2,
          clusterAutoAssignMinEvidence: 2
        }
      }
    });
    const rahulEmbedding = engine.embeddings.addEmbedding({ vector: [1, 0], photoId: 'rahul-1', confidence: 0.99, quality: 0.9 });
    const rohitEmbedding = engine.embeddings.addEmbedding({ vector: [0.9999, 0.014], photoId: 'rohit-1', confidence: 0.99, quality: 0.9 });
    engine.identities.createIdentity({ name: 'Rahul', embeddings: [rahulEmbedding] });
    engine.identities.createIdentity({ name: 'Rohit', embeddings: [rohitEmbedding] });
    engine.ingestUnknownFace({ vector: [1, 0], photoId: 'mixed-1', faceId: 'mixed-face-1', confidence: 0.96, quality: 0.86 });
    engine.ingestUnknownFace({ vector: [0.999, 0.02], photoId: 'mixed-2', faceId: 'mixed-face-2', confidence: 0.96, quality: 0.86 });

    const reconciliation = engine.reconcileUnknownClustersWithIdentities();

    assert.strictEqual(reconciliation.assignedClusters, 0);
    assert(reconciliation.deferredClusters >= 1);
    assert(Object.values(engine.state.unknownClusters).some(cluster => cluster.status === 'unknown'));
  });

  it('suppresses repeated unknown detections from the same photo before they become duplicate people', async () => {
    const engine = await enabledEngine();
    const first = engine.ingestUnknownFace({
      vector: [0, 1],
      photoId: 'group-photo',
      faceId: 'same-face',
      faceBox: { x: 25, y: 30, width: 120, height: 130, imageWidth: 800, imageHeight: 600 },
      confidence: 0.96
    });
    const duplicate = engine.ingestUnknownFace({
      vector: [0, 1],
      photoId: 'group-photo',
      faceId: 'same-face',
      faceBox: { x: 25, y: 30, width: 120, height: 130, imageWidth: 800, imageHeight: 600 },
      confidence: 0.97
    });

    assert.strictEqual(first.duplicate, false);
    assert.strictEqual(duplicate.duplicate, true);
    assert.strictEqual(first.cluster.embeddingIds.length, 1);
    assert.strictEqual(first.cluster.photoIds.length, 1);
    assert.strictEqual(first.cluster.duplicateCount, 1);
  });

  it('suppresses copied-photo face duplicates across rescans without losing the person cluster', async () => {
    const engine = await enabledEngine();
    const first = engine.ingestUnknownFace({
      vector: [0, 1],
      photoId: 'copied-original',
      faceId: 'copy-face-1',
      faceBox: { x: 80, y: 70, width: 160, height: 170, imageWidth: 1000, imageHeight: 800 },
      confidence: 0.96
    });
    const copied = engine.ingestUnknownFace({
      vector: [0, 1],
      photoId: 'copied-duplicate',
      faceId: 'copy-face-2',
      faceBox: { x: 80, y: 70, width: 160, height: 170, imageWidth: 1000, imageHeight: 800 },
      confidence: 0.97
    });

    assert.strictEqual(first.duplicate, false);
    assert.strictEqual(copied.duplicate, true);
    assert.strictEqual(first.cluster.id, copied.cluster.id);
    assert.strictEqual(first.cluster.embeddingIds.length, 1);
    assert.strictEqual(first.cluster.photoIds.length, 1);
  });

  it('keeps low-quality exact named-face matches in review instead of auto-attaching them', async () => {
    const engine = await enabledEngine();
    addTwoUnknownFaces(engine);
    const [suggestion] = engine.getEnrollmentSuggestions();
    const enrolled = engine.enrollCluster({ clusterId: suggestion.clusterId, name: 'Rahul' }).identity;
    const before = engine.listIdentities()[0].embeddingIds.length;

    const result = engine.ingestUnknownFace({
      vector: [1, 0],
      photoId: 'tiny-low-quality-face',
      faceId: 'tiny-face',
      quality: 0.28,
      confidence: 0.99
    });

    assert.strictEqual(result.autoAssigned, undefined);
    assert.strictEqual(result.cluster.status, 'unknown');
    assert.strictEqual(result.cluster.photoIds.includes('tiny-low-quality-face'), true);
    assert.strictEqual(engine.state.identities[enrolled.id].embeddingIds.length, before);
  });

  it('defers auto-recognition when a face is too close to two named people', async () => {
    const engine = await enabledEngine();
    const rahulEmbedding = engine.embeddings.addEmbedding({ vector: [1, 0], photoId: 'rahul-1', confidence: 0.99 });
    const rohitEmbedding = engine.embeddings.addEmbedding({ vector: [0.9999, 0.014], photoId: 'rohit-1', confidence: 0.99 });
    const rahul = engine.identities.createIdentity({ name: 'Rahul', embeddings: [rahulEmbedding] }).identity;
    const rohit = engine.identities.createIdentity({ name: 'Rohit', embeddings: [rohitEmbedding] }).identity;

    const result = engine.ingestUnknownFace({
      vector: [1, 0],
      photoId: 'ambiguous-group-photo',
      faceId: 'ambiguous-face',
      confidence: 0.99
    });
    const match = engine.matchFace([1, 0]);

    assert.strictEqual(result.autoAssigned, undefined);
    assert.strictEqual(result.cluster.status, 'unknown');
    assert.strictEqual(engine.state.identities[rahul.id].embeddingIds.length, 1);
    assert.strictEqual(engine.state.identities[rohit.id].embeddingIds.length, 1);
    assert.strictEqual(match.best.ambiguous, true);
    assert.strictEqual(match.best.decision, 'review');
  });

  it('exposes Face Memory through Visual Memory API and persists local state across restarts', async () => {
    const dataDir = tempDir();
    const first = new VisualMemoryEngine({ dataDir, logging: { console: false, file: false }, faces: { enrollment: { minUnknownPhotos: 2 } } });
    await first.api.start();

    assert.strictEqual((await first.api.getFaceMemoryStatus()).enabled, false);
    await first.api.enableFaceMemory({ acceptedBy: 'test-user' });
    await first.api.ingestUnknownFace({ vector: [1, 0], photoId: 'p1', faceId: 'f1', confidence: 0.95 });
    await first.api.ingestUnknownFace({ vector: [0.99, 0.01], photoId: 'p2', faceId: 'f2', confidence: 0.93 });
    const [suggestion] = await first.api.getFaceEnrollmentSuggestions();
    const enrolled = await first.api.enrollFaceCluster({ clusterId: suggestion.clusterId, name: 'Rahul', relationship: 'friend' });
    await first.api.shutdown();

    const second = new VisualMemoryEngine({ dataDir, logging: { console: false, file: false } });
    await second.api.start();
    const status = await second.api.getFaceMemoryStatus();
    const match = await second.api.matchFace([0.98, 0.02]);
    const identification = await second.api.identifyFace({ vector: [0.98, 0.02], confidence: 0.96, quality: 0.88 });
    const exportData = await second.api.exportFaceMemoryData();

    assert.strictEqual(status.enabled, true);
    assert.strictEqual(match.best.identityId, enrolled.identity.id);
    assert.strictEqual(identification.decision, 'known');
    assert.strictEqual(identification.identityId, enrolled.identity.id);
    assert.strictEqual(Object.keys(exportData.identities).length, 1);

    await second.api.resetFaceMemory();
    assert.strictEqual((await second.api.getFaceMemoryStatus()).consent.enabled, false);
    await second.api.shutdown();
  });

  it('merges duplicate unnamed clusters during Visual Memory scan cleanup', async () => {
    const dataDir = tempDir();
    const engine = new VisualMemoryEngine({
      dataDir,
      logging: { console: false, file: false },
      faces: {
        thresholds: { grouping: 0.9999 },
        enrollment: { minUnknownPhotos: 2 }
      }
    });
    await engine.api.start();
    await engine.api.enableFaceMemory({ acceptedBy: 'test-user' });
    await engine.api.ingestUnknownFace({
      vector: [0.2, 0.1, 0.3, 0.4, 0.12, 0.08, 0.22, 0.18, 0.03, 0.02, 0.04, 0.01],
      photoId: 'cleanup-duplicate-1',
      faceId: 'cleanup-face-1',
      confidence: 0.96,
      quality: 0.88,
      metadata: { vectorType: 'local-face-region-v3' }
    });
    await engine.api.ingestUnknownFace({
      vector: [0.205, 0.095, 0.31, 0.39, 0.13, 0.075, 0.21, 0.185, 0.035, 0.019, 0.041, 0.012],
      photoId: 'cleanup-duplicate-2',
      faceId: 'cleanup-face-2',
      confidence: 0.95,
      quality: 0.87,
      metadata: { vectorType: 'local-face-region-v3' }
    });

    assert.strictEqual(Object.values(engine.faces.state.unknownClusters).filter(cluster => cluster.status === 'unknown').length, 2);

    const cleanup = engine.api._cleanupUnknownFaceClusters({
      duplicateClusterSimilarity: 0.94,
      duplicateClusterMargin: 0
    });
    const clusters = Object.values(engine.faces.state.unknownClusters).filter(cluster => cluster.status === 'unknown');

    assert.strictEqual(cleanup.mergedClusters, 1);
    assert.strictEqual(clusters.length, 1);
    assert.strictEqual(clusters[0].photoIds.length, 2);

    await engine.api.shutdown();
  });

  it('merges single-photo local descriptor clusters that are similar but not exact duplicates', async () => {
    const dataDir = tempDir();
    const engine = new VisualMemoryEngine({
      dataDir,
      logging: { console: false, file: false },
      faces: {
        thresholds: { grouping: 0.9999 },
        enrollment: { minUnknownPhotos: 2 }
      }
    });
    const firstDescriptor = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const secondDescriptor = [0.965, 0.262, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    await engine.api.start();
    await engine.api.enableFaceMemory({ acceptedBy: 'test-user' });
    await engine.api.ingestUnknownFace({
      vector: firstDescriptor,
      photoId: 'same-person-angle-1',
      faceId: 'same-person-angle-face-1',
      faceBox: { x: 30, y: 42, width: 96, height: 104, imageWidth: 400, imageHeight: 400 },
      confidence: 0.96,
      quality: 0.88,
      metadata: { vectorType: 'local-face-region-v4' }
    });
    await engine.api.ingestUnknownFace({
      vector: secondDescriptor,
      photoId: 'same-person-angle-2',
      faceId: 'same-person-angle-face-2',
      faceBox: { x: 130, y: 48, width: 94, height: 102, imageWidth: 400, imageHeight: 400 },
      confidence: 0.95,
      quality: 0.87,
      metadata: { vectorType: 'local-face-region-v4' }
    });

    assert(faceEmbeddingSimilarity(firstDescriptor, secondDescriptor) >= 0.9);
    assert(faceEmbeddingSimilarity(firstDescriptor, secondDescriptor) < 0.94);
    assert.strictEqual(Object.values(engine.faces.state.unknownClusters).filter(cluster => cluster.status === 'unknown').length, 2);

    const cleanup = engine.api._cleanupUnknownFaceClusters({
      duplicateClusterSimilarity: 0.94,
      duplicateClusterMargin: 0.012
    });
    const clusters = Object.values(engine.faces.state.unknownClusters).filter(cluster => cluster.status === 'unknown');

    assert.strictEqual(cleanup.mergedClusters, 1);
    assert.strictEqual(clusters.length, 1);
    assert.strictEqual(clusters[0].photoIds.length, 2);

    await engine.api.shutdown();
  });

  it('does not merge separate people from the same group photo during cleanup', async () => {
    const dataDir = tempDir();
    const engine = new VisualMemoryEngine({
      dataDir,
      logging: { console: false, file: false },
      faces: {
        thresholds: { grouping: 0.9999 },
        enrollment: { minUnknownPhotos: 2 }
      }
    });
    await engine.api.start();
    await engine.api.enableFaceMemory({ acceptedBy: 'test-user' });
    await engine.api.ingestUnknownFace({
      vector: [0.2, 0.1, 0.3, 0.4, 0.12, 0.08, 0.22, 0.18, 0.03, 0.02, 0.04, 0.01],
      photoId: 'group-photo',
      faceId: 'group-face-left',
      faceBox: { x: 40, y: 50, width: 110, height: 120, imageWidth: 900, imageHeight: 700 },
      confidence: 0.96,
      quality: 0.88,
      metadata: { vectorType: 'local-face-region-v4' }
    });
    await engine.api.ingestUnknownFace({
      vector: [0.205, 0.095, 0.31, 0.39, 0.13, 0.075, 0.21, 0.185, 0.035, 0.019, 0.041, 0.012],
      photoId: 'group-photo',
      faceId: 'group-face-right',
      faceBox: { x: 420, y: 54, width: 112, height: 122, imageWidth: 900, imageHeight: 700 },
      confidence: 0.95,
      quality: 0.87,
      metadata: { vectorType: 'local-face-region-v4' }
    });

    const cleanup = engine.api._cleanupUnknownFaceClusters({
      duplicateClusterSimilarity: 0.9,
      duplicateClusterMargin: 0
    });
    const clusters = Object.values(engine.faces.state.unknownClusters).filter(cluster => cluster.status === 'unknown');

    assert.strictEqual(cleanup.mergedClusters, 0);
    assert.strictEqual(clusters.length, 2);

    await engine.api.shutdown();
  });
});
