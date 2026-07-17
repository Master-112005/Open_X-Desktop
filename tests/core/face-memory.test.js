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
    const exportData = await second.api.exportFaceMemoryData();

    assert.strictEqual(status.enabled, true);
    assert.strictEqual(match.best.identityId, enrolled.identity.id);
    assert.strictEqual(Object.keys(exportData.identities).length, 1);

    await second.api.resetFaceMemory();
    assert.strictEqual((await second.api.getFaceMemoryStatus()).consent.enabled, false);
    await second.api.shutdown();
  });
});
